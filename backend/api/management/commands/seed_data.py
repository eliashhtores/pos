from django.core.management.base import BaseCommand
from api.models import Category, Order, OrderItem, Product


SEED_DATA = [
    {
        "category": "Bebidas",
        "products": [
            {"name": "Café", "price": "2.50", "stock": 100},
            {"name": "Té", "price": "1.75", "stock": 100},
            {"name": "Jugo de Naranja", "price": "3.00", "stock": 80},
            {"name": "Agua (500ml)", "price": "1.00", "stock": 200},
            {"name": "Limonada", "price": "2.25", "stock": 60},
        ],
    },
    {
        "category": "Bocadillos",
        "products": [
            {"name": "Papas Fritas (Original)", "price": "1.50", "stock": 150},
            {"name": "Barra de Chocolate", "price": "1.25", "stock": 120},
            {"name": "Barra de Granola", "price": "2.00", "stock": 90},
            {"name": "Paquete de Pretzels", "price": "1.75", "stock": 100},
            {"name": "Galletas (Paquete)", "price": "3.00", "stock": 70},
        ],
    },
    {
        "category": "Comida",
        "products": [
            {"name": "Sándwich", "price": "5.50", "stock": 40},
            {"name": "Ensalada", "price": "7.00", "stock": 30},
            {"name": "Hamburguesa", "price": "8.50", "stock": 50},
            {"name": "Perro Caliente", "price": "4.00", "stock": 60},
            {"name": "Rebanada de Pizza", "price": "3.50", "stock": 45},
        ],
    },
    {
        "category": "Lácteos",
        "products": [
            {"name": "Leche (1L)", "price": "1.80", "stock": 80},
            {"name": "Yogur", "price": "2.20", "stock": 70},
            {"name": "Rebanada de Queso", "price": "0.75", "stock": 100},
        ],
    },
]


class Command(BaseCommand):
    help = "Seed the database with sample products and categories"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help=(
                "Delete all existing orders, order items, products and categories "
                "before seeding (use this to replace previously seeded data, e.g. "
                "when switching the seed data language)."
            ),
        )

    def handle(self, *args, **options):
        if options["flush"]:
            deleted_items, _ = OrderItem.objects.all().delete()
            deleted_orders, _ = Order.objects.all().delete()
            deleted_products, _ = Product.objects.all().delete()
            deleted_categories, _ = Category.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(
                    f"Flushed {deleted_orders} orders, {deleted_items} order items, "
                    f"{deleted_products} products and {deleted_categories} categories."
                )
            )

        created_categories = 0
        created_products = 0

        for entry in SEED_DATA:
            category, cat_created = Category.objects.get_or_create(name=entry["category"])
            if cat_created:
                created_categories += 1

            for p in entry["products"]:
                _, prod_created = Product.objects.get_or_create(
                    name=p["name"],
                    defaults={
                        "price": p["price"],
                        "stock": p["stock"],
                        "category": category,
                    },
                )
                if prod_created:
                    created_products += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_categories} categories and {created_products} products."
            )
        )
