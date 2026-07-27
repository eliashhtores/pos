from django.db import models as db_models
from rest_framework import serializers
from .models import Category, Product, Order, OrderItem, AccountPayable


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "description"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "barcode",
            "description",
            "price",
            "stock",
            "category",
            "category_name",
            "image_url",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_barcode(self, value):
        # Normalize blank strings to None so the unique constraint only
        # applies to products that actually have a barcode assigned.
        return value or None


class OrderItemReadSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "subtotal"]


class OrderItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["product", "quantity"]


class OrderReadSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ["id", "status", "total", "note", "items", "created_at", "updated_at"]
        read_only_fields = ["total", "created_at", "updated_at"]


class OrderWriteSerializer(serializers.ModelSerializer):
    items = OrderItemWriteSerializer(many=True)

    class Meta:
        model = Order
        fields = ["id", "note", "items", "total"]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("An order must contain at least one item.")
        # Catch duplicate products within the same order submission
        product_ids = [item["product"].id for item in value]
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError("Duplicate products in a single order are not allowed.")
        return value

    def validate(self, attrs):
        # Prevent mutating a non-pending order
        if self.instance and self.instance.status != Order.Status.PENDING:
            raise serializers.ValidationError(
                f"Cannot modify a {self.instance.status} order."
            )
        # Validate stock availability
        for item in attrs.get("items", []):
            product = item["product"]
            quantity = item["quantity"]
            if product.stock < quantity:
                raise serializers.ValidationError(
                    f"Insufficient stock for '{product.name}': "
                    f"requested {quantity}, available {product.stock}."
                )
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = Order.objects.create(**validated_data)
        for item_data in items_data:
            product = item_data["product"]
            quantity = item_data["quantity"]
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=product.price,
            )
            # Decrement stock atomically
            Product.objects.filter(pk=product.pk).update(
                stock=db_models.F("stock") - quantity
            )
        order.recalculate_total()
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        instance.note = validated_data.get("note", instance.note)

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                product = item_data["product"]
                quantity = item_data["quantity"]
                OrderItem.objects.create(
                    order=instance,
                    product=product,
                    quantity=quantity,
                    unit_price=product.price,
                )
            # Compute total and persist note + total in a single write
            instance.total = sum(item.subtotal for item in instance.items.all())
            instance.save(update_fields=["note", "total"])
        else:
            instance.save(update_fields=["note"])

        return instance


class AccountPayableSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountPayable
        fields = ["id", "name", "amount", "due_date", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]
