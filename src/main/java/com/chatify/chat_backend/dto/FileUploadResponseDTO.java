package com.chatify.chat_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FileUploadResponseDTO {
    private String fileName;
    private String fileUrl;      // final S3 URL — stored in message, used to display the file
    private String presignedUrl; // temporary PUT URL — client uploads directly to S3 with this
    private String fileType;
    private long fileSize;
}