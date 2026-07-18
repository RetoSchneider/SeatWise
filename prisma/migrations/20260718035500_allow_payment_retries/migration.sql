DROP INDEX "order_lines_reservationItemId_key";

CREATE INDEX "order_lines_reservationItemId_idx"
  ON "order_lines"("reservationItemId");
