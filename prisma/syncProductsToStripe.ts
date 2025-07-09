// scripts/syncProductsToStripe.ts

import prisma from "../src/libs/prisma";
import stripe from "../src/libs/stripe";

async function syncProducts() {
  const products = await prisma.product.findMany({
    where: {
      stripe_product_id: null,
    },
  });

  for (const product of products) {
    try {
      const stripeProduct = await stripe.products.create({
        name: product.title,
        images: product.image_url ? [product.image_url] : [],
        metadata: {
          local_product_id: product.id,
        },
      });

      const stripePrice = await stripe.prices.create({
        unit_amount: product.sale_price || product.price,
        currency: "VND",
        product: stripeProduct.id,
      });

      await prisma.product.update({
        where: { id: product.id },
        data: {
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id, // ✅
        },
      });

      // Log the successful sync
      console.log(
        `✅ Synced: ${product.title} → ${stripeProduct.id} with price ${stripePrice.id}`
      );
    } catch (err) {
      console.error(`❌ Failed to sync product ${product.title}`, err);
    }
  }

  await prisma.$disconnect();
}

syncProducts();
