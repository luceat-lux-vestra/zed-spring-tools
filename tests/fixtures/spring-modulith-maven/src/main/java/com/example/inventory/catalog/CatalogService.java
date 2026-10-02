package com.example.inventory.catalog;

import org.springframework.stereotype.Service;

import com.example.inventory.catalog.internal.CatalogRepository;

/**
 * The catalog module's only exposed type. Everything under
 * {@code catalog.internal} is internal to this application module.
 */
@Service
public class CatalogService {

    private final CatalogRepository repository;

    public CatalogService(CatalogRepository repository) {
        this.repository = repository;
    }

    public String describe(String sku) {
        return repository.find(sku);
    }
}
