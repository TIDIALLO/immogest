from django.urls import path # type: ignore
from . import views

urlpatterns = [
    path('', views.index, name='public_index'),
    path('reserver/', views.reservation_rooms_list, name='reservation_rooms_list'),
    path('reserver/<int:pk>/', views.reservation_create, name='reservation_create'),
    path('reservation/<uuid:token>/confirmation/', views.reservation_confirmation, name='reservation_confirmation'),
    path('nos-biens/', views.biens_public_list, name='biens_public_list'),
    path('nos-biens/<int:pk>/', views.bien_public_detail, name='bien_public_detail'),
    path('contact/', views.contact, name='contact'),
]
