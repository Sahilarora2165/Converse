package com.chatify.chat_backend.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/**
 * Kafka Topic Configuration.
 *
 * TOPICS:
 * - chat.messages: Main topic for message persistence (3 partitions for scalability)
 * - chat.messages.dlq: Dead Letter Queue for failed messages
 *
 * PARTITIONING:
 * - Key = chatRoomId ensures all messages for a room go to same partition
 * - This guarantees per-room ordering
 */
@Configuration
public class KafkaTopicConfig {

    @Value("${kafka.topic.chat-messages}")
    private String chatMessagesTopic;

    @Value("${kafka.topic.chat-messages-dlq:chat.messages.dlq}")
    private String dlqTopic;

    /**
     * Main topic for chat messages.
     * 3 partitions for parallel processing while maintaining per-room ordering.
     */
    @Bean
    public NewTopic chatMessagesTopic() {
        return TopicBuilder.name(chatMessagesTopic)
                .partitions(3)
                .replicas(1)
                .compact() // Enable log compaction for durability
                .build();
    }

    /**
     * Dead Letter Queue for failed message processing.
     * Messages that fail after max retries are sent here for inspection.
     */
    @Bean
    public NewTopic chatMessagesDlqTopic() {
        return TopicBuilder.name(dlqTopic)
                .partitions(1)
                .replicas(1)
                .build();
    }
}