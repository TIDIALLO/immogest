"""Format d'erreur unique : {"code": ..., "message": ..., "details": {...}}."""
from django.core.exceptions import ValidationError as DjangoValidationError  # type: ignore
from rest_framework import exceptions  # type: ignore
from rest_framework.response import Response  # type: ignore
from rest_framework.views import exception_handler as drf_exception_handler  # type: ignore


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, 'error_dict') else exc.messages
        exc = exceptions.ValidationError(detail)

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, exceptions.ValidationError):
        data = response.data
        details = data if isinstance(data, dict) else {'non_field_errors': data}
        premier = next(iter(details.values()), '')
        premier = premier[0] if isinstance(premier, (list, tuple)) and premier else premier
        return Response({'code': 'validation_error', 'message': str(premier) or 'Données invalides.',
                         'details': details}, status=response.status_code)

    message = response.data.get('detail', 'Erreur.') if isinstance(response.data, dict) else str(response.data)
    code = getattr(exc, 'default_code', 'error')
    return Response({'code': code, 'message': str(message), 'details': {}}, status=response.status_code)
