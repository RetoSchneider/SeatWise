import type { NotificationStatus } from "@/generated/prisma/enums";
import { database } from "@/shared/infrastructure/database";
import { logger } from "@/shared/infrastructure/logger";
import {
  smtpEmailSender,
  type EmailSender,
} from "@/modules/notifications/email-sender";

export interface NotificationService {
  sendEmail(input: {
    userId: string;
    recipient: string;
    type: string;
    subject: string;
    body: string;
  }): Promise<void>;
}

export function createNotificationService(
  emailSender: EmailSender = smtpEmailSender,
): NotificationService {
  return {
    async sendEmail(input) {
      const notification = await database.notification.create({
        data: {
          userId: input.userId,
          channel: "EMAIL",
          type: input.type,
          recipient: input.recipient,
          subject: input.subject,
          body: input.body,
        },
      });

      let status: NotificationStatus = "SENT";
      let failureMessage: string | undefined;

      try {
        await emailSender.send({
          to: input.recipient,
          subject: input.subject,
          text: input.body,
        });
      } catch (error) {
        status = "FAILED";
        failureMessage =
          error instanceof Error ? error.message.slice(0, 300) : "Send failed";
        logger.error(
          { notificationId: notification.id, error: failureMessage },
          "Email delivery failed",
        );
      }

      await database.notification.update({
        where: { id: notification.id },
        data: {
          status,
          failureMessage,
          sentAt: status === "SENT" ? new Date() : undefined,
        },
      });
    },
  };
}

export const notificationService = createNotificationService();
