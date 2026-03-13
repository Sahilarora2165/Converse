package com.chatify.chat_backend.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    @Value("${kafka.topic.chat-messages}")
    private String chatMessagesTopic;

    // Default to 3 partitions for scalability
    @Bean
    public NewTopic chatMessagesTopic() {
        return TopicBuilder.name(chatMessagesTopic)
                .partitions(3)
                .replicas(1)
                .build();
    }
}