package com.example.inventory.order;

import org.springframework.stereotype.Service;

import com.example.inventory.catalog.CatalogService;
import com.example.inventory.catalog.internal.CatalogRepository;

/**
 * The first dependency is legal: {@code CatalogService} is exposed by the catalog
 * module. The second is the violation this fixture exists for — it reaches into
 * {@code catalog.internal}, which no other application module may reference.
 */
@Service
public class OrderService {

    private final CatalogService catalog;
    private final CatalogRepository repository;

    public OrderService(CatalogService catalog, CatalogRepository repository) {
        this.catalog = catalog;
        this.repository = repository;
    }

    public String place(String sku) {
        return catalog.describe(sku) + "/" + repository.find(sku);
    }
}
