/**
 * Schema index: re-exports all tables and declares Drizzle relations.
 * Use with query.with() for eager loading. No circular imports: tables
 * are imported from domain files and relations reference them here.
 */
import { relations } from "drizzle-orm";
import { adminLogs } from "./admins";
import { commissionSettings } from "./commission";
import { emailVerificationTokens, users } from "./users";
import { noShowFees, reservations } from "./reservations";
import { notifications } from "./notifications";
import { ratings } from "./ratings";
import {
  stationConfigs,
  stations,
  vehicleFormats,
} from "./stations";
import { supportTickets } from "./support";
import { timeSlots } from "./slots";

export * from "./users";
export * from "./admins";
export * from "./stations";
export * from "./slots";
export * from "./reservations";
export * from "./ratings";
export * from "./notifications";
export * from "./commission";
export * from "./support";
export * from "./settings";

export const usersRelations = relations(users, ({ many }) => ({
  emailVerificationTokens: many(emailVerificationTokens),
  reservations: many(reservations, { relationName: "userReservations" }),
  ratings: many(ratings, { relationName: "userRatings" }),
  supportTickets: many(supportTickets),
  notifications: many(notifications, { relationName: "userNotifications" }),
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

export const adminLogsRelations = relations(adminLogs, ({ one }) => ({
  admin: one(users, {
    fields: [adminLogs.admin_id],
    references: [users.id],
  }),
}));

export const stationsRelations = relations(stations, ({ one, many }) => ({
  approvedByAdmin: one(users, {
    fields: [stations.approved_by],
    references: [users.id],
  }),
  stationConfig: one(stationConfigs),
  vehicleFormats: many(vehicleFormats),
  timeSlots: many(timeSlots),
  reservations: many(reservations, { relationName: "stationReservations" }),
  ratings: many(ratings, { relationName: "stationRatings" }),
  notifications: many(notifications, { relationName: "stationNotifications" }),
}));

export const stationConfigsRelations = relations(stationConfigs, ({ one }) => ({
  station: one(stations, {
    fields: [stationConfigs.id],
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

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  createdByUser: one(users, {
    fields: [supportTickets.created_by],
    references: [users.id],
  }),
  assignedToAdmin: one(users, {
    fields: [supportTickets.assigned_to],
    references: [users.id],
  }),
}));
