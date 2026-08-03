package com.mulaerp.product.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.product.dto.ProductDto;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * WP: product images (zero-copyright defaults). Stores uploaded product photos on the local
 * filesystem (a directory volume-mapped in compose.yaml so uploads survive container restarts)
 * under a generated, never-trusted filename, and serves them back through
 * {@code GET /api/v1/public/images/{filename}} - see ProductImageController.
 *
 * Deliberately never persists or trusts the client's original filename beyond reading its
 * extension: the stored filename is always {@code UUID.randomUUID() + "." + extension}, and
 * every filename this service is given (on both store and load) is validated to contain no path
 * separators or ".." before being resolved against the configured base directory, closing off
 * path traversal.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductImageService {

    /** ~5MB cap per the product-images spec. */
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");

    public static final String PUBLIC_IMAGE_PATH_PREFIX = "/api/v1/public/images/";

    private final ProductRepository productRepository;
    private final ProductService productService;

    @Value("${mulaerp.uploads.product-images-dir:./uploads/product-images}")
    private String uploadDir;

    /** A file loaded from disk, ready to be written straight into a {@code ResponseEntity<byte[]>}. */
    public record StoredImage(byte[] content, MediaType contentType) {}

    /**
     * Validates and stores the uploaded file, updates the product's imageUrl, evicts the
     * product's cached DTO (mirroring every other product-mutating path in ProductService), and
     * returns the refreshed DTO.
     */
    @Transactional
    public ProductDto storeProductImage(UUID productId, MultipartFile file) {
        Product product = productRepository.findByIdAndDeletedFalse(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Image file is required");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("Image file exceeds the 5MB size limit");
        }

        String extension = extractExtension(file.getOriginalFilename());
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException(
                    "Unsupported image type - allowed extensions: " + ALLOWED_EXTENSIONS);
        }

        String previousImageUrl = product.getImageUrl();
        String storedFilename = UUID.randomUUID() + "." + extension;

        try {
            Path baseDir = baseDirPath();
            Files.createDirectories(baseDir);
            Path target = resolveWithinBase(baseDir, storedFilename);
            file.transferTo(target);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store product image: " + e.getMessage(), e);
        }

        product.setImageUrl(PUBLIC_IMAGE_PATH_PREFIX + storedFilename);
        productRepository.saveAndFlush(product);

        // Best-effort cleanup of the file a replaced photo leaves behind - never fails the
        // upload if it can't be deleted (e.g. already gone), same non-blocking-side-effect
        // convention as email/auto-journal hooks elsewhere in the codebase.
        deletePreviousImageFileQuietly(previousImageUrl);

        productService.evictProductCache(productId);
        return productService.getProductById(productId);
    }

    /**
     * Resolves a requested filename against the configured base directory. Returns
     * {@code Optional.empty()} for an unknown (but validly-shaped) filename so the controller can
     * answer 404; throws {@link IllegalArgumentException} (mapped to 400 by
     * GlobalExceptionHandler) for anything that looks like a path traversal attempt.
     */
    public Optional<StoredImage> loadImage(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Invalid filename");
        }

        String extension = extractExtension(filename);
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension)
                || filename.contains("/") || filename.contains("\\") || filename.contains("..")) {
            throw new IllegalArgumentException("Invalid filename");
        }

        Path baseDir = baseDirPath();
        Path candidate = resolveWithinBase(baseDir, filename);

        if (!Files.isRegularFile(candidate)) {
            return Optional.empty();
        }

        try {
            byte[] data = Files.readAllBytes(candidate);
            return Optional.of(new StoredImage(data, mediaTypeForExtension(extension)));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read product image: " + e.getMessage(), e);
        }
    }

    private Path baseDirPath() {
        return Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    /**
     * Resolves {@code filename} against {@code baseDir} and verifies the normalized result is
     * still contained within it - the actual path-traversal guard. A ".."-laden filename would
     * normalize to somewhere outside baseDir and fail the {@code startsWith} check.
     */
    private Path resolveWithinBase(Path baseDir, String filename) {
        Path candidate = baseDir.resolve(filename).normalize();
        if (!candidate.startsWith(baseDir)) {
            throw new IllegalArgumentException("Invalid filename");
        }
        return candidate;
    }

    private String extractExtension(String filename) {
        if (filename == null) {
            return null;
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return null;
        }
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private MediaType mediaTypeForExtension(String extension) {
        return switch (extension) {
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG;
            case "png" -> MediaType.IMAGE_PNG;
            case "webp" -> MediaType.valueOf("image/webp");
            default -> MediaType.APPLICATION_OCTET_STREAM;
        };
    }

    private void deletePreviousImageFileQuietly(String previousImageUrl) {
        if (previousImageUrl == null || !previousImageUrl.startsWith(PUBLIC_IMAGE_PATH_PREFIX)) {
            return;
        }
        String previousFilename = previousImageUrl.substring(PUBLIC_IMAGE_PATH_PREFIX.length());
        if (previousFilename.isBlank() || previousFilename.contains("/") || previousFilename.contains("..")) {
            return;
        }
        try {
            Files.deleteIfExists(baseDirPath().resolve(previousFilename));
        } catch (IOException e) {
            log.warn("Failed to delete previous product image '{}': {}", previousFilename, e.getMessage());
        }
    }
}
