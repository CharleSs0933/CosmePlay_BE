"use strict";
// scripts/syncProductsToStripe.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../src/libs/prisma"));
const stripe_1 = __importDefault(require("../src/libs/stripe"));
function syncProducts() {
    return __awaiter(this, void 0, void 0, function* () {
        const products = yield prisma_1.default.product.findMany({
            where: {
                stripe_product_id: null,
            },
        });
        for (const product of products) {
            try {
                const stripeProduct = yield stripe_1.default.products.create({
                    name: product.title,
                    images: product.image_url ? [product.image_url] : [],
                    metadata: {
                        local_product_id: product.id,
                    },
                });
                const stripePrice = yield stripe_1.default.prices.create({
                    unit_amount: product.sale_price || product.price,
                    currency: "VND",
                    product: stripeProduct.id,
                });
                yield prisma_1.default.product.update({
                    where: { id: product.id },
                    data: {
                        stripe_product_id: stripeProduct.id,
                        stripe_price_id: stripePrice.id, // ✅
                    },
                });
                // Log the successful sync
                console.log(`✅ Synced: ${product.title} → ${stripeProduct.id} with price ${stripePrice.id}`);
            }
            catch (err) {
                console.error(`❌ Failed to sync product ${product.title}`, err);
            }
        }
        yield prisma_1.default.$disconnect();
    });
}
syncProducts();
