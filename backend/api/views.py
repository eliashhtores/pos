from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Category, Product, Order
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    OrderReadSerializer,
    OrderWriteSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "category__name"]
    ordering_fields = ["name", "price", "stock", "created_at"]

    def get_queryset(self):
        qs = Product.objects.select_related("category").all()
        # Filter by is_active when the query param is explicitly provided.
        # The cashier view passes ?is_active=true; the management view omits it
        # so that inactive products are also visible and editable.
        is_active_param = self.request.query_params.get("is_active")
        if is_active_param is not None:
            qs = qs.filter(is_active=is_active_param.lower() == "true")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        return qs


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.prefetch_related("items__product").all()
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at", "total", "status"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return OrderWriteSerializer
        return OrderReadSerializer

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        order = self.get_object()
        if order.status == Order.Status.COMPLETED:
            return Response({"detail": "Order is already completed."}, status=status.HTTP_400_BAD_REQUEST)
        order.status = Order.Status.COMPLETED
        order.save(update_fields=["status"])
        return Response(OrderReadSerializer(order).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status == Order.Status.CANCELLED:
            return Response({"detail": "Order is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)
        order.status = Order.Status.CANCELLED
        order.save(update_fields=["status"])
        return Response(OrderReadSerializer(order).data)
