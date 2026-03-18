package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.FileUploadResponseDTO;
import com.chatify.chat_backend.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

    @Value("${aws.s3.access-key:}")
    private String accessKey;

    @Value("${aws.s3.secret-key:}")
    private String secretKey;

    @Value("${aws.s3.bucket-name:}")
    private String bucketName;

    @Value("${aws.s3.region:ap-south-1}")
    private String region;

    @Value("${aws.s3.presigned-url-expiry-minutes:5}")
    private int presignedUrlExpiryMinutes;

    private S3Presigner presigner;
    private boolean s3Enabled = false;

    private static final Map<String, Long> ALLOWED_TYPES = Map.of(
            "image/jpeg",       5L  * 1024 * 1024,
            "image/png",        5L  * 1024 * 1024,
            "image/gif",        5L  * 1024 * 1024,
            "image/webp",       5L  * 1024 * 1024,
            "application/pdf",  10L * 1024 * 1024,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 10L * 1024 * 1024,
            "video/mp4",        50L * 1024 * 1024,
            "video/quicktime",  50L * 1024 * 1024,
            "video/x-msvideo",  50L * 1024 * 1024
    );

    private static final Map<String, String[]> TYPE_TO_EXTENSIONS = Map.of(
            "image/jpeg",       new String[]{".jpg", ".jpeg"},
            "image/png",        new String[]{".png"},
            "image/gif",        new String[]{".gif"},
            "image/webp",       new String[]{".webp"},
            "application/pdf",  new String[]{".pdf"},
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new String[]{".docx"},
            "video/mp4",        new String[]{".mp4"},
            "video/quicktime",  new String[]{".mov"},
            "video/x-msvideo",  new String[]{".avi"}
    );

    @PostConstruct
    public void init() {
        // Only initialize S3 if credentials are provided
        if (accessKey != null && !accessKey.isBlank() && 
            secretKey != null && !secretKey.isBlank() && 
            bucketName != null && !bucketName.isBlank()) {
            
            try {
                AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKey, secretKey);
                this.presigner = S3Presigner.builder()
                        .region(Region.of(region))
                        .credentialsProvider(StaticCredentialsProvider.create(credentials))
                        .build();
                this.s3Enabled = true;
                log.info("S3 file storage initialized successfully for bucket: {}", bucketName);
            } catch (Exception e) {
                log.warn("Failed to initialize S3 file storage: {}. File uploads will be disabled.", e.getMessage());
                this.s3Enabled = false;
            }
        } else {
            log.info("AWS S3 credentials not configured. File uploads will be disabled. " +
                     "Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME to enable.");
            this.s3Enabled = false;
        }
    }

    public FileUploadResponseDTO generatePresignedUrl(String originalFileName, String contentType, long fileSize) {
        if (!s3Enabled) {
            throw new BadRequestException("File uploads are not configured. Please set up AWS S3 credentials.");
        }
        
        validateFileMetadata(originalFileName, contentType, fileSize);

        String extension = getExtension(originalFileName);
        String s3Key = "uploads/" + UUID.randomUUID() + extension;

        // no ACL needed — bucket policy allows public read on uploads/*
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Key)
                .contentType(contentType)
                .contentLength(fileSize)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .putObjectRequest(putObjectRequest)
                .signatureDuration(Duration.ofMinutes(presignedUrlExpiryMinutes))
                .build();

        PresignedPutObjectRequest presignedRequest = presigner.presignPutObject(presignRequest);

        String presignedUrl = presignedRequest.url().toString();
        String fileUrl = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + s3Key;

        return new FileUploadResponseDTO(originalFileName, fileUrl, presignedUrl, contentType, fileSize);
    }
    
    /**
     * Check if S3 file storage is enabled.
     */
    public boolean isS3Enabled() {
        return s3Enabled;
    }

    private void validateFileMetadata(String fileName, String contentType, long fileSize) {
        if (fileName == null || fileName.isBlank()) {
            throw new BadRequestException("File name is required");
        }

        if (contentType == null || !ALLOWED_TYPES.containsKey(contentType)) {
            throw new BadRequestException("File type not allowed: " + contentType);
        }

        long maxSize = ALLOWED_TYPES.get(contentType);
        if (fileSize <= 0 || fileSize > maxSize) {
            throw new BadRequestException("File size invalid. Max allowed for " + contentType + ": " + (maxSize / (1024 * 1024)) + "MB");
        }

        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new BadRequestException("Invalid file name");
        }

        String extension = getExtension(fileName);
        String[] validExtensions = TYPE_TO_EXTENSIONS.get(contentType);
        boolean extensionValid = false;
        for (String valid : validExtensions) {
            if (valid.equals(extension)) {
                extensionValid = true;
                break;
            }
        }
        if (!extensionValid) {
            throw new BadRequestException("File extension does not match content type");
        }
    }

    private String getExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            throw new BadRequestException("File has no extension");
        }
        String extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
        if (!extension.matches("^\\.[a-z0-9]+$")) {
            throw new BadRequestException("Invalid file extension");
        }
        return extension;
    }
}