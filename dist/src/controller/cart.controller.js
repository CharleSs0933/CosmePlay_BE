"use strict";
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
exports.deleteCartItem = exports.updateCartItemQuantity = exports.getCart = exports.addToCart = void 0;
const error_handler_1 = require("../packages/error-handler");
const prisma_1 = __importDefault(require("../libs/prisma"));
const addToCart = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { productId, quantity } = req.body;
        if (!productId || !quantity || quantity <= 0 || !user) {
            return next(new error_handler_1.ValidationError("Invalid data provided!"));
        }
        const product = yield prisma_1.default.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            return next(new error_handler_1.ValidationError("Product not found!"));
        }
        let cart = yield prisma_1.default.cart.findUnique({
            where: { user_id: user.id },
        });
        if (!cart) {
            cart = yield prisma_1.default.cart.create({
                data: { user_id: user.id },
            });
        }
        const cartItem = yield prisma_1.default.cartLineItem.findFirst({
            where: { product_id: productId, cart_id: cart.id },
        });
        if (cartItem) {
            yield prisma_1.default.cartLineItem.update({
                where: { id: cartItem.id },
                data: { quantity: cartItem.quantity + quantity },
            });
        }
        else {
            yield prisma_1.default.cartLineItem.create({
                data: { cart_id: cart.id, product_id: productId, quantity },
            });
        }
        res.status(200).json({ success: true, message: "Product added to cart!" });
    }
    catch (error) {
        next(error);
    }
});
exports.addToCart = addToCart;
const getCart = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        let cart = yield prisma_1.default.cart.findUnique({
            where: { user_id: user.id },
            include: {
                cartItems: {
                    include: {
                        product: true,
                    },
                },
            },
        });
        if (!cart) {
            cart = yield prisma_1.default.cart.create({
                data: { user_id: user.id },
                include: {
                    cartItems: {
                        include: {
                            product: true,
                        },
                    },
                },
            });
        }
        res.status(200).json({ success: true, cart });
    }
    catch (error) {
        next(error);
    }
});
exports.getCart = getCart;
const updateCartItemQuantity = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { productId, quantity } = req.body;
        if (!productId || !quantity || quantity <= 0 || !user) {
            return next(new error_handler_1.ValidationError("Invalid data provided!"));
        }
        const cart = yield prisma_1.default.cart.findUnique({
            where: { user_id: user.id },
        });
        if (!cart) {
            return next(new error_handler_1.ValidationError("Cart not found!"));
        }
        const cartItem = yield prisma_1.default.cartLineItem.findFirst({
            where: { product_id: productId, cart_id: cart.id },
        });
        if (!cartItem) {
            return next(new error_handler_1.ValidationError("Cart item not found!"));
        }
        yield prisma_1.default.cartLineItem.update({
            where: { id: cartItem.id },
            data: { quantity },
        });
        res
            .status(200)
            .json({ success: true, message: "Cart item quantity updated!" });
    }
    catch (error) {
        next(error);
    }
});
exports.updateCartItemQuantity = updateCartItemQuantity;
const deleteCartItem = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { productId } = req.params;
        if (!productId || !user) {
            return next(new error_handler_1.ValidationError("Invalid data provided!"));
        }
        const cart = yield prisma_1.default.cart.findUnique({
            where: { user_id: user.id },
        });
        if (!cart) {
            return next(new error_handler_1.ValidationError("Cart not found!"));
        }
        const cartItem = yield prisma_1.default.cartLineItem.findFirst({
            where: { product_id: productId, cart_id: cart.id },
        });
        if (!cartItem) {
            return next(new error_handler_1.ValidationError("Cart item not found!"));
        }
        yield prisma_1.default.cartLineItem.delete({
            where: { id: cartItem.id },
        });
        res.status(200).json({ success: true, message: "Cart item deleted!" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteCartItem = deleteCartItem;
