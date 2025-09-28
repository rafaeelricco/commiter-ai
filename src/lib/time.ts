export { DateOnly, TimeOfDay, POSIX };

import * as s from "@/lib/json/schema";

import { DateTime } from "luxon";
import { Failure, Success } from "@/lib/result";

class POSIX {
  static fromDate(d: Date): POSIX {
    return new POSIX(d.valueOf());
  }

  static now(): POSIX {
    return new POSIX(Date.now());
  }

  value: number;
  constructor(n: number) {
    this.value = n;
  }

  toDate(): Date {
    return new Date(this.value);
  }

  greaterThan(other: POSIX) {
    return this.value > other.value;
  }

  compare(other: POSIX): number {
    return (
      this.value > other.value ? 1
      : this.value < other.value ? -1
      : 0
    );
  }

  static fromUTCDateAndTime(date: DateOnly, time: TimeOfDay): POSIX {
    const s = `${date.pretty()}T${time.pretty()}Z`;
    const luxonDate = DateTime.fromISO(s, { zone: "UTC" });
    return POSIX.fromDate(luxonDate.toJSDate());
  }

  toUTCDateAndTime(): { date: DateOnly; time: TimeOfDay } {
    const dt = DateTime.fromMillis(this.value, { zone: "UTC" });
    const date = new DateOnly(dt.year, dt.month, dt.day);
    const time = TimeOfDay.fromParts({
      hours: dt.hour,
      minutes: dt.minute,
      seconds: dt.second
    });
    return { date, time };
  }

  toLocalDateAndTime(): { date: DateOnly; time: TimeOfDay } {
    const dt = DateTime.fromMillis(this.value, { zone: "UTC" }).toLocal();
    const date = new DateOnly(dt.year, dt.month, dt.day);
    const time = TimeOfDay.fromParts({
      hours: dt.hour,
      minutes: dt.minute,
      seconds: dt.second
    });
    return { date, time };
  }
}

const padded = (v: number) => v.toString().padStart(2, "0");

class DateOnly {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-30ish

  constructor(year: number, month: number, day: number) {
    this.year = year;
    this.month = month;
    this.day = day;
  }

  static today(): DateOnly {
    return DateOnly.fromDate(new Date());
  }

  static fromDate(date: Date): DateOnly {
    return new DateOnly(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  pretty() {
    return `${this.year}-${padded(this.month)}-${padded(this.day)}`;
  }

  static schema: s.Schema<DateOnly> = s.string.then(
    (s) => {
      const parts = s.split("-");
      if (parts.length !== 3) {
        return Failure("Invalid Date");
      }
      const year = parseInt(parts[0] as string, 10);
      const month = parseInt(parts[1] as string, 10);
      const day = parseInt(parts[2] as string, 10);

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return Failure("Invalid Date");
      }

      return Success(new DateOnly(year, month, day));
    },
    (date) => date.pretty()
  );

  greaterThan(other: DateOnly) {
    return this.compare(other) == 1;
  }

  compare(other: DateOnly): number {
    return (
      this.year > other.year ? 1
      : this.year < other.year ? -1
      : this.month > other.month ? 1
      : this.month < other.month ? -1
      : this.day > other.day ? 1
      : this.day < other.day ? -1
      : 0
    );
  }
}

class TimeOfDay {
  constructor(readonly seconds: number) {}

  static fromParts({ hours, minutes, seconds }: { hours: number; minutes: number; seconds: number }): TimeOfDay {
    return new TimeOfDay(hours * 60 * 60 + minutes * 60 + seconds);
  }

  pretty() {
    const hours = padded(Math.floor(this.seconds / (60 * 60)));
    const minutes = padded(Math.floor(this.seconds / 60) % 60);
    const wholeSeconds = padded(Math.floor(this.seconds) % 60);
    return `${hours}:${minutes}:${wholeSeconds}`;
  }

  getSubSecondPrecision(): number {
    return this.seconds - Math.floor(this.seconds);
  }
}
