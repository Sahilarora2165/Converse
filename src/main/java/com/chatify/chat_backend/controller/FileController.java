package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.FileUploadResponseDTO;
import com.chatify.chat_backend.service.FileStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileStorageService fileStorageService;

    public FileController(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    // Client calls this with file metadata — gets back a presigned URL to PUT directly to S3
    @PostMapping("/presigned-url")
    public ResponseEntity<FileUploadResponseDTO> getPresignedUrl(
            @RequestParam("fileName") String fileName,
            @RequestParam("contentType") String contentType,
            @RequestParam("fileSize") long fileSize,
            Authentication authentication) {

        FileUploadResponseDTO response = fileStorageService.generatePresignedUrl(fileName, contentType, fileSize);
        return ResponseEntity.ok(response);
    }
}