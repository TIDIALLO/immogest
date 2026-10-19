from django.apps import AppConfig # type: ignore


class SitePublicConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'site_public'
    verbose_name = 'Site public'
