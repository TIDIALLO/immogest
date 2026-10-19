"""Authentification : session (SPA, même origine) + JWT (clients mobiles) + mot de passe."""
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash  # type: ignore
from django.contrib.auth import password_validation  # type: ignore
from django.contrib.auth.models import User  # type: ignore
from django.contrib.auth.tokens import default_token_generator  # type: ignore
from django.core.exceptions import ValidationError as DjangoValidationError  # type: ignore
from django.core.mail import send_mail  # type: ignore
from django.utils.decorators import method_decorator  # type: ignore
from django.utils.encoding import force_bytes, force_str  # type: ignore
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode  # type: ignore
from django.views.decorators.csrf import ensure_csrf_cookie  # type: ignore
from drf_spectacular.utils import extend_schema  # type: ignore
from rest_framework import serializers  # type: ignore
from rest_framework.permissions import AllowAny, IsAuthenticated  # type: ignore
from rest_framework.response import Response  # type: ignore
from rest_framework.throttling import ScopedRateThrottle  # type: ignore
from rest_framework.views import APIView  # type: ignore

from gestion.models import Notification


def serialiser_utilisateur(user):
    locataire = getattr(user, 'locataire_profile', None)
    return {
        'id': user.pk,
        'username': user.username,
        'nom': user.get_full_name() or user.username,
        'email': user.email,
        'role': 'locataire' if locataire else 'gestionnaire',
        'is_staff': user.is_staff,
        'locataire_id': locataire.pk if locataire else None,
        'notifications_non_lues': Notification.objects.filter(destinataire=user, lue=False).count(),
    }


class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(ensure_csrf_cookie)
    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response({'detail': 'CSRF cookie défini.'})


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    @extend_schema(request=LoginSerializer, responses={200: dict})
    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = authenticate(request, username=data.validated_data['username'],
                            password=data.validated_data['password'])
        if user is None:
            raise serializers.ValidationError({'non_field_errors': ['Identifiant ou mot de passe incorrect.']})
        login(request, user)
        return Response(serialiser_utilisateur(user))


class LogoutView(APIView):
    @extend_schema(request=None, responses={200: dict})
    def post(self, request):
        logout(request)
        return Response({'detail': 'Déconnecté.'})


class MeView(APIView):
    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response(serialiser_utilisateur(request.user))


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    @extend_schema(request=PasswordResetRequestSerializer, responses={200: dict})
    def post(self, request):
        data = PasswordResetRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        base = request.build_absolute_uri('/').rstrip('/')
        for user in User.objects.filter(email__iexact=data.validated_data['email'], is_active=True):
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            lien = f'{base}/app/reinitialiser/{uid}/{default_token_generator.make_token(user)}'
            send_mail('Réinitialisation de votre mot de passe ImmoGest',
                      f'Pour choisir un nouveau mot de passe, ouvrez ce lien :\n{lien}', None, [user.email],
                      fail_silently=True)
        # Réponse identique que l'adresse existe ou non (pas d'énumération de comptes).
        return Response({'detail': "Si un compte correspond, un email vient d'être envoyé."})


class PasswordConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)


class PasswordConfirmView(APIView):
    """Définit le mot de passe via un lien à usage unique (invitation locataire ou mot de passe oublié)."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    @extend_schema(request=PasswordConfirmSerializer, responses={200: dict})
    def post(self, request):
        data = PasswordConfirmSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(data.validated_data['uid'])))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None
        if user is None or not default_token_generator.check_token(user, data.validated_data['token']):
            raise serializers.ValidationError({'token': ['Ce lien est invalide ou a expiré.']})
        try:
            password_validation.validate_password(data.validated_data['password'], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': exc.messages})
        user.set_password(data.validated_data['password'])
        user.is_active = True
        user.save()
        return Response({'detail': 'Mot de passe défini. Vous pouvez vous connecter.', 'username': user.username})


class PasswordChangeSerializer(serializers.Serializer):
    ancien = serializers.CharField(write_only=True)
    nouveau = serializers.CharField(write_only=True)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=PasswordChangeSerializer, responses={200: dict})
    def post(self, request):
        data = PasswordChangeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        if not request.user.check_password(data.validated_data['ancien']):
            raise serializers.ValidationError({'ancien': ['Mot de passe actuel incorrect.']})
        try:
            password_validation.validate_password(data.validated_data['nouveau'], request.user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'nouveau': exc.messages})
        request.user.set_password(data.validated_data['nouveau'])
        request.user.save()
        update_session_auth_hash(request, request.user)
        return Response({'detail': 'Mot de passe mis à jour.'})
