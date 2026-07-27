from django.core.management.base import BaseCommand
from api.models import Category, Order, OrderItem, Product


SEED_DATA = [
    {
        "category": "Bebidas",
        "products": [
            {"name": "Café", "barcode": "750100000019", "price": "2.50", "stock": 100},
            {"name": "Té", "barcode": "750100000026", "price": "1.75", "stock": 100},
            {"name": "Jugo de Naranja", "barcode": "750100000033", "price": "3.00", "stock": 80},
            {"name": "Agua (500ml)", "barcode": "750100000040", "price": "1.00", "stock": 200},
            {"name": "Limonada", "barcode": "750100000057", "price": "2.25", "stock": 60},
        ],
    },
    {
        "category": "Bocadillos",
        "products": [
            {"name": "Papas Fritas (Original)", "barcode": "750100001016", "price": "1.50", "stock": 150},
            {"name": "Barra de Chocolate", "barcode": "750100001023", "price": "1.25", "stock": 120},
            {"name": "Barra de Granola", "barcode": "750100001030", "price": "2.00", "stock": 90},
            {"name": "Paquete de Pretzels", "barcode": "750100001047", "price": "1.75", "stock": 100},
            {"name": "Galletas (Paquete)", "barcode": "750100001054", "price": "3.00", "stock": 70},
        ],
    },
    {
        "category": "Comida",
        "products": [
            {"name": "Sándwich", "barcode": "750100002013", "price": "5.50", "stock": 40},
            {"name": "Ensalada", "barcode": "750100002020", "price": "7.00", "stock": 30},
            {"name": "Hamburguesa", "barcode": "750100002037", "price": "8.50", "stock": 50},
            {"name": "Perro Caliente", "barcode": "750100002044", "price": "4.00", "stock": 60},
            {"name": "Rebanada de Pizza", "barcode": "750100002051", "price": "3.50", "stock": 45},
        ],
    },
    {
        "category": "Lácteos",
        "products": [
            {"name": "Leche (1L)", "barcode": "750100003010", "price": "1.80", "stock": 80},
            {"name": "Yogur", "barcode": "750100003027", "price": "2.20", "stock": 70},
            {"name": "Rebanada de Queso", "barcode": "750100003034", "price": "0.75", "stock": 100},
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
                        "barcode": p.get("barcode"),
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
