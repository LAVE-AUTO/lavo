/**
 * Schema index: re-exports all tables and declares Drizzle relations.
 * Use with query.with() for eager loading. No circular imports: tables
 * are imported from domain files and relations reference them here.
 */
import { relations } from "drizzle-orm";
import { adminLogs } from "./admins";
import { commissionSettings } from "./commission";
import { rescheduleRequests } from "./reschedule-requests";
import { delayRequests } from "./delay-requests";
import { emailVerificationTokens, users } from "./users";
import { refreshTokens } from "./refresh-tokens";
import { noShowFees, reservations } from "./reservations";
import { notifications } from "./notifications";
import { ratings } from "./ratings";
import { disputes } from "./disputes";
import { deviceTokens } from "./device-tokens";
import {
  pendingUploads,
  stationConfigs,
  stationDocuments,
  stationPosts,
  stations,
  stationWashTypes,
  vehicleFormats,
  washTypes,
} from "./stations";
import { supportMessages, supportSettings, supportTickets } from "./support";
import { reservationTips } from "./tips";
import { timeSlots } from "./slots";

export * from "./users";
export * from "./admins";
export * from "./stations";
export * from "./delay-requests";
export * from "./slots";
export * from "./reservations";
export * from "./ratings";
export * from "./notifications";
export * from "./commission";
export * from "./support";
export * from "./settings";
export * from "./auth-rate-limits";
export * from "./refresh-tokens";
export * from "./reschedule-requests";
export * from "./tips";
export * from "./disputes";
export * from "./device-tokens";

export const usersRelations = relations(users, ({ one, many }) => ({
  station: one(stations, {
    fields: [users.id],
    references: [stations.user_id],
  }),
  emailVerificationTokens: many(emailVerificationTokens),
  refreshTokens: many(refreshTokens),
  reservations: many(reservations, { relationName: "userReservations" }),
  ratings: many(ratings, { relationName: "userRatings" }),
  supportTickets: many(supportTickets, { relationName: "ticketCreator" }),
  assignedTickets: many(supportTickets, { relationName: "ticketAssignee" }),
  supportMessages: many(supportMessages, { relationName: "messageSender" }),
  notifications: many(notifications, { relationName: "userNotifications" }),
  deviceTokens: many(deviceTokens),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.user_id],
      references: [users.id],
    }),
  })
);

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.user_id],
    references: [users.id],
  }),
}));

export const adminLogsRelations = relations(adminLogs, ({ one }) => ({
  admin: one(users, {
    fields: [adminLogs.admin_id],
    references: [users.id],
  }),
}));

export const stationsRelations = relations(stations, ({ one, many }) => ({
  manager: one(users, {
    fields: [stations.user_id],
    references: [users.id],
    relationName: "stationManager",
  }),
  approvedByAdmin: one(users, {
    fields: [stations.approved_by],
    references: [users.id],
    relationName: "stationApprover",
  }),
  stationConfig: one(stationConfigs),
  stationPosts: many(stationPosts),
  stationWashTypes: many(stationWashTypes),
  documents: many(stationDocuments),
  vehicleFormats: many(vehicleFormats),
  timeSlots: many(timeSlots),
  reservations: many(reservations, { relationName: "stationReservations" }),
  ratings: many(ratings, { relationName: "stationRatings" }),
  notifications: many(notifications, { relationName: "stationNotifications" }),
}));

export const washTypesRelations = relations(washTypes, ({ many }) => ({
  stationWashTypes: many(stationWashTypes),
}));

export const stationWashTypesRelations = relations(stationWashTypes, ({ one }) => ({
  station: one(stations, {
    fields: [stationWashTypes.station_id],
    references: [stations.id],
  }),
  washType: one(washTypes, {
    fields: [stationWashTypes.wash_type_id],
    references: [washTypes.id],
  }),
}));

export const stationDocumentsRelations = relations(stationDocuments, ({ one, many }) => ({
  station: one(stations, {
    fields: [stationDocuments.station_id],
    references: [stations.id],
  }),
  pendingUploads: many(pendingUploads),
}));

export const pendingUploadsRelations = relations(pendingUploads, ({ one }) => ({
  stationDocument: one(stationDocuments, {
    fields: [pendingUploads.station_document_id],
    references: [stationDocuments.id],
  }),
}));

export const stationConfigsRelations = relations(stationConfigs, ({ one }) => ({
  station: one(stations, {
    fields: [stationConfigs.id],
    references: [stations.id],
  }),
}));

export const stationPostsRelations = relations(stationPosts, ({ one }) => ({
  station: one(stations, {
    fields: [stationPosts.station_id],
    references: [stations.id],
  }),
}));

export const vehicleFormatsRelations = relations(vehicleFormats, ({ one }) => ({
  station: one(stations, {
    fields: [vehicleFormats.station_id],
    references: [stations.id],
  }),
}));

export const timeSlotsRelations = relations(timeSlots, ({ one, many }) => ({
  station: one(stations, {
    fields: [timeSlots.station_id],
    references: [stations.id],
  }),
  reservations: many(reservations),
}));

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  user: one(users, {
    fields: [reservations.user_id],
    references: [users.id],
  }),
  timeSlot: one(timeSlots, {
    fields: [reservations.time_slot_id],
    references: [timeSlots.id],
  }),
  station: one(stations, {
    fields: [reservations.station_id],
    references: [stations.id],
  }),
  vehicleFormat: one(vehicleFormats, {
    fields: [reservations.vehicle_format_id],
    references: [vehicleFormats.id],
  }),
  noShowFees: many(noShowFees),
  ratings: one(ratings),
  notifications: many(notifications, { relationName: "reservationNotifications" }),
}));

export const noShowFeesRelations = relations(noShowFees, ({ one }) => ({
  reservation: one(reservations, {
    fields: [noShowFees.reservation_id],
    references: [reservations.id],
  }),
  user: one(users, {
    fields: [noShowFees.user_id],
    references: [users.id],
  }),
  station: one(stations, {
    fields: [noShowFees.station_id],
    references: [stations.id],
  }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  reservation: one(reservations, {
    fields: [ratings.reservation_id],
    references: [reservations.id],
  }),
  user: one(users, {
    fields: [ratings.user_id],
    references: [users.id],
  }),
  station: one(stations, {
    fields: [ratings.station_id],
    references: [stations.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id],
  }),
  station: one(stations, {
    fields: [notifications.station_id],
    references: [stations.id],
  }),
  reservation: one(reservations, {
    fields: [notifications.reservation_id],
    references: [reservations.id],
  }),
}));

export const commissionSettingsRelations = relations(
  commissionSettings,
  ({ one }) => ({
    setByAdmin: one(users, {
      fields: [commissionSettings.set_by],
      references: [users.id],
    }),
  })
);

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [supportTickets.created_by],
    references: [users.id],
    relationName: "ticketCreator",
  }),
  assignedToAdmin: one(users, {
    fields: [supportTickets.assigned_to],
    references: [users.id],
    relationName: "ticketAssignee",
  }),
  messages: many(supportMessages, { relationName: "ticketMessages" }),
}));

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportMessages.ticket_id],
    references: [supportTickets.id],
    relationName: "ticketMessages",
  }),
  sender: one(users, {
    fields: [supportMessages.sender_id],
    references: [users.id],
    relationName: "messageSender",
  }),
}));

export const rescheduleRequestsRelations = relations(rescheduleRequests, ({ one }) => ({
  originalReservation: one(reservations, {
    fields: [rescheduleRequests.original_reservation_id],
    references: [reservations.id],
    relationName: 'originalReschedule',
  }),
  newReservation: one(reservations, {
    fields: [rescheduleRequests.new_reservation_id],
    references: [reservations.id],
    relationName: 'newReschedule',
  }),
  user: one(users, {
    fields: [rescheduleRequests.user_id],
    references: [users.id],
  }),
  station: one(stations, {
    fields: [rescheduleRequests.station_id],
    references: [stations.id],
  }),
}));

export const delayRequestsRelations = relations(delayRequests, ({ one }) => ({
  reservation: one(reservations, {
    fields: [delayRequests.reservation_id],
    references: [reservations.id],
  }),
  user: one(users, {
    fields: [delayRequests.user_id],
    references: [users.id],
  }),
  station: one(stations, {
    fields: [delayRequests.station_id],
    references: [stations.id],
  }),
}));

export const reservationTipsRelations = relations(reservationTips, ({ one }) => ({
  reservation: one(reservations, {
    fields: [reservationTips.reservation_id],
    references: [reservations.id],
  }),
  client: one(users, {
    fields: [reservationTips.client_id],
    references: [users.id],
  }),
  station: one(stations, {
    fields: [reservationTips.station_id],
    references: [stations.id],
  }),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.user_id],
    references: [users.id],
  }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  reservation: one(reservations, {
    fields: [disputes.reservation_id],
    references: [reservations.id],
  }),
  client: one(users, {
    fields: [disputes.client_id],
    references: [users.id],
    relationName: "disputeClient",
  }),
  station: one(stations, {
    fields: [disputes.station_id],
    references: [stations.id],
  }),
  closedByAdmin: one(users, {
    fields: [disputes.closed_by],
    references: [users.id],
    relationName: "disputeClosedBy",
  }),
}));
