package com.example.inventory.catalog.internal;

import org.springframework.stereotype.Repository;

/** Internal to the catalog module: no other module may reference this type. */
@Repository
public class CatalogRepository {

    public String find(String sku) {
        return "item-" + sku;
    }
}
