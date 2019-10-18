import * as ko from "knockout";
import * as Constants from "../../../../../constants";
import template from "./product-list-dropdown.html";
import { Component, RuntimeComponent, OnMounted, OnDestroyed } from "@paperbits/common/ko/decorators";
import { ProductService } from "../../../../../services/productService";
import { Product } from "../../../../../models/product";
import { SearchQuery } from "../../../../../contracts/searchQuery";
import { Router } from "@paperbits/common/routing/router";

@RuntimeComponent({ selector: "product-list-dropdown-runtime" })
@Component({
    selector: "product-list-dropdown-runtime",
    template: template,
    injectable: "productListDropdown"
})
export class ProductListDropdown {
    public readonly products: ko.ObservableArray<Product>;
    public readonly working: ko.Observable<boolean>;
    public readonly selectedId: ko.Observable<string>;
    public readonly pattern: ko.Observable<string>;
    public readonly page: ko.Observable<number>;
    public readonly hasPager: ko.Computed<boolean>;
    public readonly hasPrevPage: ko.Observable<boolean>;
    public readonly hasNextPage: ko.Observable<boolean>;
    public readonly expanded: ko.Observable<boolean>;
    public readonly selectedProduct: ko.Observable<Product>;
    public readonly selection: ko.Computed<string>;
    private productsDropdown: HTMLElement;

    constructor(
        private readonly productService: ProductService,
        private readonly router: Router) {
        this.working = ko.observable();
        this.selectedId = ko.observable();
        this.pattern = ko.observable();
        this.page = ko.observable(1);
        this.hasPrevPage = ko.observable();
        this.hasNextPage = ko.observable();
        this.hasPager = ko.computed(() => this.hasPrevPage() || this.hasNextPage());
        this.products = ko.observableArray();
        this.selectedProduct = ko.observable();
        this.expanded = ko.observable(false);
        this.selection = ko.computed(() => {
            const product = ko.unwrap(this.selectedProduct);
            return product ? product.name : "Select Product";
        });
    }

    @OnMounted()
    public async initialize(): Promise<void> {
        await this.loadPageOfProducts();

        this.pattern
            .extend({ rateLimit: { timeout: Constants.defaultInputDelayMs, method: "notifyWhenChangesStop" } })
            .subscribe(this.searchProducts);
        
        document.addEventListener("click", this.checkClickOutside, false);
        if (!this.productsDropdown) {
            this.productsDropdown = document.getElementById("products-dropdown");
        }
        if (this.productsDropdown) {
            this.productsDropdown.addEventListener("keyup", this.onKeyUp, false);
        }
    }

    private checkClickOutside(event: any): void {
        if(this.expanded() && this.productsDropdown) {
            const inside = this.productsDropdown.contains(event.target);
            if (!inside) {
                this.toggle();
            }
        }
    }

    private onKeyUp(event: any): void {
        if(this.expanded()) {
            if (event && event.key === "Escape") {
                this.toggle();
            }
        } else {
            if (event && event.key === "Enter") {
                this.expanded(true);
            }
        }
    }

    private getSelectedProductId(): string {
        const route = this.router.getCurrentRoute();
        const queryParams = new URLSearchParams(route.hash || (route.url.indexOf("?") !== -1 ? route.url.split("?").pop() : ""));
        const productId = queryParams.get("productId");

        return productId;
    }

    /**
     * Initiates searching Products.
     */
    public async searchProducts(): Promise<void> {
        this.page(1);
        this.loadPageOfProducts();
    }

    /**
     * Loads page of Products.
     */
    public async loadPageOfProducts(): Promise<void> {
        try {
            this.working(true);

            const pageNumber = this.page() - 1;

            const query: SearchQuery = {
                pattern: this.pattern(),
                skip: pageNumber * Constants.defaultPageSize,
                take: Constants.defaultPageSize
            };

            const itemsPage = await this.productService.getProductsPage(query);

            this.products(itemsPage.value);
            this.hasPrevPage(pageNumber > 0);
            this.hasNextPage(!!itemsPage.nextLink);

            const productId = this.getSelectedProductId();
            this.selectedProduct(productId ? itemsPage.value.find(item => item.id.endsWith(productId)) : itemsPage.value[0]);
        }
        catch (error) {
            console.error(`Unable to load APIs. ${error}`);
        }
        finally {
            this.working(false);
        }
    }

    public prevPage(): void {
        this.page(this.page() - 1);
        this.loadPageOfProducts();
    }

    public nextPage(): void {
        this.page(this.page() + 1);
        this.loadPageOfProducts();
    }

    public toggle(): void {
        this.expanded(!this.expanded());
    }

    public getProductUrl(product: Product): string {
        return product.id.replace("/products/", `${Constants.productReferencePageUrl}#?productId=`);
    }

    @OnDestroyed()
    public dispose(): void {
        document.removeEventListener("click", this.checkClickOutside, false);
        if (this.productsDropdown) {
            this.productsDropdown.removeEventListener("keyup", this.onKeyUp, false);
        }
    }
}