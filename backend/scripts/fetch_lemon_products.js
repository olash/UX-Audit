import 'dotenv/config';

const API_KEY = process.env.LEMON_API_KEY;
const STORE_ID = process.env.STORE_ID;

if (!API_KEY) {
    console.error("❌ LEMON_API_KEY is missing from .env");
    process.exit(1);
}

async function fetchProducts() {
    console.log("🔄 Fetching products from Lemon Squeezy...");

    try {
        const response = await fetch('https://api.lemonsqueezy.com/v1/products?include=variants', {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/vnd.api+json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        console.log("\n📦 Products & Variants Found:");

        data.data.forEach(product => {
            console.log(`\n🔹 Product: ${product.attributes.name} (ID: ${product.id})`);

            // Find variants for this product based on relationships
            // The 'included' array contains the variants
            const variantIds = product.relationships.variants.data.map(v => v.id);

            variantIds.forEach(vId => {
                const variant = data.included.find(item => item.type === "variants" && item.id === vId);
                if (variant) {
                    const price = variant.attributes.price / 100; // Convert cents to dollars
                    console.log(`   🔸 Variant: ${variant.attributes.name} (ID: ${variant.id}) - Price: $${price}`);
                }
            });
        });

    } catch (error) {
        console.error("❌ Error fetching products:", error.message);
    }
}

fetchProducts();
