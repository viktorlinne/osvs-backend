import type { Contact, Extract } from "../../scripts/migration/lib/types";

export function contact(overrides: Partial<Contact> & { Id: number }): Contact {
  return {
    lastname: "Andersson",
    firstname: "Anders",
    address: "Gatan 1",
    zipcode: "123 45",
    city: "Göteborg",
    phone1: "",
    phone2: "",
    mobile: "0701-234567",
    email: "",
    civicno: "1950-01-02",
    grade: "",
    official: "",
    plist: false,
    pnotes: "",
    memberno: "",
    notes: "",
    link: "",
    filename: "",
    archive: "",
    lodge: "Orion",
    userId: "",
    password: "",
    accesslevel: null,
    passwordSalt: "",
    ...overrides,
  };
}

export function emptyExtract(overrides: Partial<Extract> = {}): Extract {
  return {
    contacts: [],
    contactsCv: [],
    events: [],
    eventsItems: [],
    tEvents: [],
    mail: [],
    mailItems: [],
    news: [],
    sourceDate: "2026-10-20",
    ...overrides,
  };
}
