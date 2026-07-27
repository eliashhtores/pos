from django.contrib import admin
from .models import Category, Product, Order, OrderItem, AccountPayable


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["id", "name"]
    search_fields = ["name"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "barcode", "price", "stock", "category", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["name", "barcode"]


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ["unit_price", "subtotal"]

    def subtotal(self, obj):
        return obj.subtotal


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "total", "created_at"]
    list_filter = ["status"]
    readonly_fields = ["total", "created_at", "updated_at"]
    inlines = [OrderItemInline]


@admin.register(AccountPayable)
class AccountPayableAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "amount", "due_date"]
    search_fields = ["name"]
    ordering = ["due_date"]
