package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.*;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.service.ChatRoomService;
import com.chatify.chat_backend.service.MessageService;
import com.chatify.chat_backend.service.PresenceService;
import com.chatify.chat_backend.service.UserService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.LocalDateTime;

@Controller
public class ChatWebSocketController {

    private final SimpMessageSendingOperations messagingTemplate;
    private final MessageService messageService;
    private final UserService userService;
    private final ChatRoomService chatRoomService;
    private final PresenceService presenceService;

    public ChatWebSocketController(SimpMessageSendingOperations messagingTemplate,
                                   MessageService messageService,
                                   UserService userService,
                                   ChatRoomService chatRoomService,
                                   PresenceService presenceService) {
        this.messagingTemplate = messagingTemplate;
        this.messageService = messageService;
        this.userService = userService;
        this.chatRoomService = chatRoomService;
        this.presenceService = presenceService;
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload SendMessageDTO messageDTO, Principal principal) {
        if (principal == null) {
            return;
        }

        String email = principal.getName();
        User sender = userService.getUserEntityByEmail(email);

        if (!chatRoomService.isUserInChatRoom(messageDTO.getChatRoomId(), sender.getId())) {
            return;
        }

        MessageDTO savedMessage = messageService.sendMessage(messageDTO, sender.getId());

        messagingTemplate.convertAndSend(
                "/topic/chatroom/" + messageDTO.getChatRoomId(),
                savedMessage
        );
    }


    @MessageMapping("/chat/{roomId}/sendMessage")
    public void sendMessage(
            @DestinationVariable Long roomId,
            @Payload SendMessageDTO sendMessageDTO,
            Principal principal
    ) {
        if (principal == null) {
            System.out.println("Principal is null - Message rejected");
            return;
        }

        // 1. Identify the Sender
        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        // 2. Enforce the Room ID from the URL path
        sendMessageDTO.setChatRoomId(roomId);

        // 3. Persist the Message (Save to DB)
        MessageDTO savedMessage = messageService.sendMessage(sendMessageDTO, user.getId());

        // 4. Broadcast to Subscribers (The critical step!)
        messagingTemplate.convertAndSend("/topic/chatroom/" + roomId, savedMessage);
    }

//    @MessageMapping("/chat.typing/{chatRoomId}")
//    public void handleTyping(@DestinationVariable Long chatRoomId,
//                            @Payload TypingStatusDTO typingStatus,
//                            Principal principal) {
//        if (principal == null) {
//            return;
//        }
//
//        String email = principal.getName();
//        User user = userService.getUserEntityByEmail(email);
//
//        if (!chatRoomService.isUserInChatRoom(chatRoomId, user.getId())) {
//            return;
//        }
//
//        TypingStatusDTO statusDTO = new TypingStatusDTO(
//                user.getId(),
//                user.getUsername(),
//                chatRoomId,
//                typingStatus.isTyping()
//        );
//
//        messagingTemplate.convertAndSend(
//                "/topic/chatroom/" + chatRoomId + "/typing",
//                statusDTO
//        );
//    }

    @MessageMapping("/chat.read/{messageId}")
    public void handleReadReceipt(@DestinationVariable Long messageId, Principal principal) {
        if (principal == null) {
            return;
        }

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        MessageDTO message = messageService.markMessageAsRead(messageId, user.getId());

        ReadReceiptDTO readReceipt = new ReadReceiptDTO(
                messageId,
                user.getId(),
                user.getUsername(),
                message.getChatRoomId(),
                LocalDateTime.now()
        );

        messagingTemplate.convertAndSend(
                "/topic/chatroom/" + message.getChatRoomId() + "/read",
                readReceipt
        );
    }

    @MessageMapping("/presence.update")
    public void updatePresence(@Payload OnlineStatusDTO statusDTO, Principal principal) {
        if (principal == null) {
            return;
        }

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        OnlineStatusDTO updatedStatus = presenceService.updateUserPresence(user.getId(), statusDTO.getStatus());
        presenceService.broadcastPresenceChange(updatedStatus);
    }

    @MessageMapping("/presence.connected")
    public void userConnected(Principal principal) {
        if (principal == null) {
            return;
        }

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);
        presenceService.userConnected(user.getId());
    }

    @MessageMapping("/presence.disconnected")
    public void userDisconnected(Principal principal) {
        if (principal == null) {
            return;
        }

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);
        presenceService.userDisconnected(user.getId());
    }

    @MessageMapping("/chat.delivered")
    public void handleDeliveredAck(
            @Payload MessageDeliveredAckDTO ack,
            Principal principal
    ) {
        if (principal == null) {
            return;
        }

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        MessageDeliveryUpdateDTO update =
                messageService.markMessagesAsDelivered(
                        ack.getChatRoomId(),
                        user.getId(),
                        ack.getLastDeliveredMessageId()
                );

        if (update != null) {
            messagingTemplate.convertAndSend(
                    "/topic/chatroom/" + ack.getChatRoomId() + "/delivery",
                    update
            );
        }
    }

    @MessageMapping("/chat.seen")
    public void handleSeenAck(
            @Payload MessageSeenAckDTO ack,
            Principal principal
    ) {
        if (principal == null) {
            return;
        }

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        MessageDeliveryUpdateDTO update =
                messageService.markMessagesAsSeen(
                        ack.getChatRoomId(),
                        user.getId(),
                        ack.getLastSeenMessageId()
                );

        if (update != null) {
            messagingTemplate.convertAndSend(
                    "/topic/chatroom/" + ack.getChatRoomId() + "/seen",
                    update
            );
        }
    }

}
