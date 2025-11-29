package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.FileUploadResponseDTO;
import com.chatify.chat_backend.exception.BadRequestException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    private Path fileStorageLocation;

    private static final List<String> ALLOWED_CONTENT_TYPES = Arrays.asList(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain"
    );

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    @PostConstruct
    public void init() {
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (IOException ex) {
            throw new RuntimeException("Could not create upload directory", ex);
        }
    }

    public FileUploadResponseDTO uploadFile(MultipartFile file) {
        validateFile(file);

        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename());
        String fileExtension = getFileExtension(originalFileName);
        String newFileName = UUID.randomUUID().toString() + fileExtension;

        try {
            Path targetLocation = this.fileStorageLocation.resolve(newFileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            String fileUrl = "/uploads/" + newFileName;
            
            return new FileUploadResponseDTO(
                    originalFileName,
                    fileUrl,
                    file.getContentType(),
                    file.getSize()
            );
        } catch (IOException ex) {
            throw new RuntimeException("Could not store file " + originalFileName, ex);
        }
    }

    public void deleteFile(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }

        String fileName = fileUrl.replace("/uploads/", "");
        try {
            Path filePath = this.fileStorageLocation.resolve(fileName).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException ex) {
            throw new RuntimeException("Could not delete file " + fileName, ex);
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("File size exceeds maximum limit of 10MB");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BadRequestException("File type not allowed. Allowed types: JPEG, PNG, GIF, WEBP, PDF, DOC, DOCX, TXT");
        }

        String originalFileName = file.getOriginalFilename();
        if (originalFileName != null && originalFileName.contains("..")) {
            throw new BadRequestException("Invalid file name");
        }

        String extension = getFileExtension(originalFileName);
        if (!isExtensionMatchingContentType(extension, contentType)) {
            throw new BadRequestException("File extension does not match content type");
        }
    }

    private String getFileExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        String extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
        if (!extension.matches("^\\.[a-z0-9]+$")) {
            throw new BadRequestException("Invalid file extension");
        }
        return extension;
    }

    private boolean isExtensionMatchingContentType(String extension, String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> extension.equals(".jpg") || extension.equals(".jpeg");
            case "image/png" -> extension.equals(".png");
            case "image/gif" -> extension.equals(".gif");
            case "image/webp" -> extension.equals(".webp");
            case "application/pdf" -> extension.equals(".pdf");
            case "application/msword" -> extension.equals(".doc");
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> extension.equals(".docx");
            case "text/plain" -> extension.equals(".txt");
            default -> false;
        };
    }
}
