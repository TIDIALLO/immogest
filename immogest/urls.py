from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),

    # Réinitialisation de mot de passe (comptes propriétaires ET locataires)
    path('gestion/mot-de-passe-oublie/', auth_views.PasswordResetView.as_view(
        template_name='gestion/password_reset.html'), name='password_reset'),
    path('gestion/mot-de-passe-oublie/envoye/', auth_views.PasswordResetDoneView.as_view(
        template_name='gestion/password_reset_done.html'), name='password_reset_done'),
    path('gestion/reinitialiser/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='gestion/password_reset_confirm.html'), name='password_reset_confirm'),
    path('gestion/reinitialiser/termine/', auth_views.PasswordResetCompleteView.as_view(
        template_name='gestion/password_reset_complete.html'), name='password_reset_complete'),

    path('gestion/', include('gestion.urls')),
    path('', include('site_public.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
