import { ACCESS_COOKIE, REFRESH_COOKIE } from "../config/constants";

const FRONTEND = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
  /\/$/,
  "",
);
const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.APP_URL ||
  "http://localhost:4000"
).replace(/\/$/, "");

const authSecurity = [{ bearerAuth: [] }, { accessCookieAuth: [] }];

const badRequest = { "400": { $ref: "#/components/responses/BadRequest" } };
const unauthorized = { "401": { $ref: "#/components/responses/Unauthorized" } };
const forbidden = { "403": { $ref: "#/components/responses/Forbidden" } };
const notFound = { "404": { $ref: "#/components/responses/NotFound" } };
const conflict = { "409": { $ref: "#/components/responses/Conflict" } };
const internal = { "500": { $ref: "#/components/responses/InternalServerError" } };
const rateLimited = { "429": { $ref: "#/components/responses/TooManyRequests" } };
const pictureUploadBadRequest = {
  "400": {
    description: "Invalid picture upload or form validation failure.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
        example: {
          message: "Formuläret innehåller fel",
          details: {
            fields: {
              picture: "Den uppladdade bilden är ogiltig",
            },
          },
        },
      },
    },
  },
};
const fileUploadBadRequest = {
  "400": {
    description: "Invalid file upload or form validation failure.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
        example: {
          message: "Formuläret innehåller fel",
          details: {
            fields: {
              file: "Endast PDF-filer är tillåtna",
            },
          },
        },
      },
    },
  },
};
const pictureUploadInternal = {
  "500": {
    description: "Picture upload/storage failed.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
        example: { message: "Kunde inte ladda upp bilden" },
      },
    },
  },
};
const fileUploadInternal = {
  "500": {
    description: "File upload/storage failed.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
        example: { message: "Kunde inte ladda upp filen" },
      },
    },
  },
};
const authSessionExample = {
  inactivityTimeoutMs: 900000,
  inactivityExpiresAt: "2026-03-09T13:15:00.000Z",
  refreshWindowDays: 30,
};

export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: process.env.APP_NAME || "OSVS API",
    version: process.env.APP_VERSION || "1.0.0",
    description:
      "Complete OpenAPI documentation for all currently mounted /api backend routes.",
  },
  servers: [
    { url: `${BACKEND}/api`, description: "Backend API base URL" },
    { url: FRONTEND, description: "Frontend origin" },
  ],
  tags: [
    { name: "System", description: "Health and runtime checks." },
    { name: "Docs", description: "OpenAPI JSON and Swagger UI." },
    { name: "Auth", description: "Authentication/session endpoints." },
    { name: "Users", description: "User profile and membership operations." },
    { name: "Events", description: "Events, RSVP, food, and attendance operations." },
    { name: "Posts", description: "Post listing and content management." },
    { name: "Lodges", description: "Lodge listing and management." },
    { name: "Admin", description: "Admin utilities." },
    { name: "Payments", description: "Membership payment endpoints." },
    { name: "Officials", description: "Officials catalogue and assignments." },
    { name: "Allergies", description: "Allergies catalogue and assignments." },
    { name: "Revisions", description: "Revision listing and upload endpoints." },
    { name: "Documents", description: "Document listing and upload endpoints." },
    { name: "Achievements", description: "Achievement catalogue endpoints." },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "JWT token via Authorization header (`Authorization: Bearer <token>`).",
      },
      accessCookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: ACCESS_COOKIE,
        description: "HTTP-only access token cookie used by protected endpoints.",
      },
      refreshCookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: REFRESH_COOKIE,
        description:
          "HTTP-only refresh token cookie used by `/auth/refresh` and `/auth/heartbeat`.",
      },
    },
    responses: {
      BadRequest: {
        description: "Invalid input, malformed parameters, or validation failure.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: {
              message: "Formuläret innehåller fel",
              details: {
                fields: {
                  email: "Ogiltig e-postadress",
                  zipcode: "Det här fältet är obligatoriskt",
                },
              },
            },
          },
        },
      },
      Unauthorized: {
        description: "Authentication required or invalid token/session.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: { message: "Obehörig" },
          },
        },
      },
      Forbidden: {
        description: "Authenticated user lacks required role/permissions.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: { message: "Åtkomst nekad" },
          },
        },
      },
      NotFound: {
        description: "Resource not found.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: { message: "Hittades inte" },
          },
        },
      },
      Conflict: {
        description: "Data conflict (for example duplicate unique value).",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: { message: "Konflikt" },
          },
        },
      },
      TooManyRequests: {
        description: "Rate limit exceeded.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: { message: "För många förfrågningar" },
          },
        },
      },
      InternalServerError: {
        description: "Unhandled internal server error.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: { message: "Ett internt serverfel uppstod" },
          },
        },
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        description: "Unified error envelope used by all endpoints.",
        required: ["message"],
        properties: {
          message: { type: "string", example: "Obehörig" },
          details: {
            type: "object",
            nullable: true,
            properties: {
              fields: {
                type: "object",
                additionalProperties: { type: "string" },
                example: {
                  email: "Ogiltig e-postadress",
                  zipcode: "Det här fältet är obligatoriskt",
                },
              },
            },
          },
        },
      },
      MessageResponse: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string", example: "Åtgärden genomfördes" } },
      },
      SessionMetadata: {
        type: "object",
        required: [
          "inactivityTimeoutMs",
          "inactivityExpiresAt",
          "refreshWindowDays",
        ],
        properties: {
          inactivityTimeoutMs: {
            type: "integer",
            example: authSessionExample.inactivityTimeoutMs,
          },
          inactivityExpiresAt: {
            type: "string",
            format: "date-time",
            example: authSessionExample.inactivityExpiresAt,
          },
          refreshWindowDays: {
            type: "integer",
            example: authSessionExample.refreshWindowDays,
          },
        },
      },
      AuthSessionResponse: {
        type: "object",
        required: ["session"],
        properties: {
          session: { $ref: "#/components/schemas/SessionMetadata" },
        },
      },
      SuccessResponse: {
        type: "object",
        required: ["success"],
        properties: { success: { type: "boolean", example: true } },
      },
      SuccessWithIdResponse: {
        type: "object",
        required: ["success", "id"],
        properties: {
          success: { type: "boolean", example: true },
          id: { type: "integer", example: 42 },
        },
      },
      HealthResponse: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", example: "OK 1760000000000" } },
      },
      RoleValue: {
        type: "string",
        enum: ["Admin", "Editor", "Member"],
        example: "Admin",
      },
      Role: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          role: { $ref: "#/components/schemas/RoleValue" },
          name: { type: "string", example: "Admin" },
        },
      },
      LodgeReference: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Stamlogen" },
        },
      },
      PublicUser: {
        type: "object",
        properties: {
          matrikelnummer: { type: "integer", example: 7 },
          email: { type: "string", format: "email", example: "admin@example.com" },
          firstname: { type: "string", example: "Admin" },
          lastname: { type: "string", example: "Example" },
          dateOfBirth: { type: "string", example: "1900-01-01" },
          mobile: { type: "string", example: "0707070707" },
          city: { type: "string", example: "Stockholm" },
          address: { type: "string", example: "Storgatan 1" },
          zipcode: { type: "string", example: "22233" },
          picture: { type: "string", nullable: true },
          pictureUrl: { type: "string", nullable: true },
          work: { type: "string", nullable: true },
          homeNumber: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          accommodationAvailable: { type: "boolean", nullable: true },
          archive: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time", nullable: true },
          revokedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      PublicUserResponse: {
        type: "object",
        required: ["user"],
        properties: {
          user: { $ref: "#/components/schemas/PublicUser" },
        },
      },
      PublicUserWithRelations: {
        allOf: [
          { $ref: "#/components/schemas/PublicUser" },
          {
            type: "object",
            properties: {
              allergies: {
                type: "array",
                items: { $ref: "#/components/schemas/Allergy" },
              },
              officials: {
                type: "array",
                items: { $ref: "#/components/schemas/Official" },
              },
              officialHistory: {
                type: "array",
                items: { $ref: "#/components/schemas/OfficialHistory" },
              },
            },
          },
        ],
      },
      PublicUserProfileResponse: {
        type: "object",
        required: ["user", "achievements", "allergies", "officials", "officialHistory"],
        properties: {
          user: { $ref: "#/components/schemas/PublicUserWithRelations" },
          achievements: {
            type: "array",
            items: { $ref: "#/components/schemas/Achievement" },
          },
          allergies: {
            type: "array",
            items: { $ref: "#/components/schemas/Allergy" },
          },
          officials: {
            type: "array",
            items: { $ref: "#/components/schemas/Official" },
          },
          officialHistory: {
            type: "array",
            items: { $ref: "#/components/schemas/OfficialHistory" },
          },
        },
      },
      AuthContextResponse: {
        type: "object",
        required: [
          "user",
          "roles",
          "achievements",
          "allergies",
          "officials",
          "officialHistory",
          "session",
        ],
        properties: {
          user: { $ref: "#/components/schemas/PublicUserWithRelations" },
          roles: {
            type: "array",
            items: { $ref: "#/components/schemas/RoleValue" },
          },
          achievements: {
            type: "array",
            items: { $ref: "#/components/schemas/Achievement" },
          },
          allergies: {
            type: "array",
            items: { $ref: "#/components/schemas/Allergy" },
          },
          officials: {
            type: "array",
            items: { $ref: "#/components/schemas/Official" },
          },
          officialHistory: {
            type: "array",
            items: { $ref: "#/components/schemas/OfficialHistory" },
          },
          session: { $ref: "#/components/schemas/SessionMetadata" },
        },
      },
      RoleValuesResponse: {
        type: "object",
        required: ["roles"],
        properties: {
          roles: {
            type: "array",
            items: { $ref: "#/components/schemas/RoleValue" },
          },
        },
      },
      UserWithRolesResponse: {
        type: "object",
        required: ["user", "roles"],
        properties: {
          user: { $ref: "#/components/schemas/PublicUser" },
          roles: {
            type: "array",
            items: { $ref: "#/components/schemas/RoleValue" },
          },
        },
      },
      PictureUploadResponse: {
        type: "object",
        required: ["pictureKey", "pictureUrl"],
        properties: {
          pictureKey: { type: "string", example: "profiles/abc.webp" },
          pictureUrl: {
            type: "string",
            example: "https://cdn.example/profiles/abc.webp",
          },
        },
      },
      EventSummary: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Founders Meeting" },
          description: { type: "string", nullable: true },
          startDate: { type: "string", example: "2026-03-14 18:00:00" },
          endDate: { type: "string", example: "2026-03-14 21:00:00" },
          lodgeMeeting: { type: "boolean", nullable: true },
          food: { type: "boolean", nullable: true },
          price: { type: "number", format: "float", example: 275 },
        },
      },
      EventAttendance: {
        type: "object",
        properties: {
          uid: { type: "integer", example: 7 },
          firstname: { type: "string", example: "Admin" },
          lastname: { type: "string", example: "Example" },
          allergies: { type: "array", items: { type: "string" } },
          rsvp: { type: "boolean" },
          bookFood: { type: "boolean" },
          attended: { type: "boolean" },
          paymentStatus: { type: "string", nullable: true, example: "Pending" },
          paymentPaid: { type: "boolean" },
        },
      },
      Lodge: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Stamlogen" },
          city: { type: "string", example: "Karlskrona" },
          description: { type: "string", nullable: true },
          email: { type: "string", nullable: true },
          picture: { type: "string", nullable: true },
        },
      },
      Achievement: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          aid: { type: "integer", nullable: true },
          title: { type: "string", example: "I:a Graden" },
          awardedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      Allergy: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Gluten" },
        },
      },
      Official: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Ordensmastare" },
        },
      },
      OfficialHistory: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Ordensmastare" },
          appointedAt: { type: "string", format: "date-time" },
          unappointedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      PostSummary: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Welcome to OSVS" },
          description: { type: "string", example: "Post preview" },
          pictureUrl: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      PostDetail: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Welcome to OSVS" },
          description: { type: "string", example: "Post body" },
          publicum: { type: "boolean", nullable: true },
          picture: { type: "string", nullable: true },
          pictureUrl: { type: "string", nullable: true },
          lodges: {
            type: "array",
            items: { $ref: "#/components/schemas/LodgeReference" },
          },
        },
      },
      Revision: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          lid: { type: "integer", example: 1 },
          lodgeName: { type: "string", example: "Stamlogen" },
          title: { type: "string", example: "Stamlogen Revision" },
          year: { type: "integer", example: 2026 },
          picture: { type: "string", nullable: true },
          pictureUrl: { type: "string", nullable: true },
        },
      },
      Document: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Stadgar 2026" },
          picture: { type: "string", nullable: true },
          pictureUrl: { type: "string", nullable: true },
        },
      },
      MembershipPayment: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          uid: { type: "integer", example: 7 },
          amount: { type: "number", format: "float", example: 450 },
          year: { type: "integer", example: 2026 },
          status: { type: "string", enum: ["Pending", "Paid"], example: "Pending" },
          createdAt: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      AttendedEventsSummary: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "integer", example: 1 },
                title: { type: "string", example: "Founders Meeting" },
                startDate: { type: "string", example: "2026-03-14 18:00:00" },
                endDate: { type: "string", example: "2026-03-14 21:00:00" },
              },
            },
          },
          sinceLastAchievementCount: { type: "integer", example: 3 },
          lastAchievementAt: { type: "string", nullable: true },
          totalMeetingsCount: { type: "integer", example: 12 },
        },
      },
      UserMapPin: {
        type: "object",
        properties: {
          id: { type: "integer", example: 7 },
          name: { type: "string", example: "Admin Example" },
          lat: { type: "number", format: "float", example: 56.16 },
          lng: { type: "number", format: "float", example: 15.58 },
          lodgeId: { type: "integer", nullable: true },
          lodgeName: { type: "string", nullable: true },
          highestGradeRank: { type: "integer", nullable: true },
          highestGrade: { type: "string", nullable: true },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "viktor.linne@gmail.com" },
          password: { type: "string", format: "password", example: "asd123" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: [
          "email",
          "password",
          "firstname",
          "lastname",
          "dateOfBirth",
          "mobile",
          "city",
          "address",
          "zipcode",
          "picture",
        ],
        properties: {
          email: { type: "string", format: "email", example: "new.user@example.com" },
          password: { type: "string", format: "password" },
          firstname: { type: "string", example: "New" },
          lastname: { type: "string", example: "User" },
          dateOfBirth: { type: "string", example: "1990-06-15" },
          work: { type: "string", nullable: true },
          mobile: { type: "string", example: "0700000000" },
          homeNumber: { type: "string", nullable: true },
          city: { type: "string", example: "Karlskrona" },
          address: { type: "string", example: "Example Street 1" },
          zipcode: { type: "string", example: "37130" },
          notes: { type: "string", nullable: true },
          lodgeId: { type: "integer", nullable: true, example: 1 },
          picture: { type: "string", format: "binary" },
        },
      },
      UpdateUserProfileRequest: {
        type: "object",
        properties: {
          firstname: { type: "string" },
          lastname: { type: "string" },
          dateOfBirth: { type: "string" },
          work: { type: "string", nullable: true },
          mobile: { type: "string" },
          city: { type: "string" },
          address: { type: "string" },
          zipcode: { type: "string" },
          notes: { type: "string", nullable: true },
          accommodationAvailable: { type: "boolean", nullable: true },
        },
      },
      AddAchievementRequest: {
        type: "object",
        required: ["achievementId"],
        properties: {
          achievementId: { type: "integer", example: 1 },
          awardedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      SetRolesRequest: {
        type: "object",
        required: ["roleIds"],
        properties: {
          roleIds: {
            type: "array",
            items: { type: "integer", example: 1 },
            minItems: 1,
          },
        },
      },
      SetLodgeRequest: {
        type: "object",
        required: ["lodgeId"],
        properties: {
          lodgeId: {
            oneOf: [{ type: "integer", example: 1 }, { type: "null" }],
          },
        },
      },
      SetUserLocationRequest: {
        type: "object",
        required: ["lat", "lng"],
        properties: {
          lat: { type: "number", format: "float", example: 56.16 },
          lng: { type: "number", format: "float", example: 15.58 },
        },
      },
      SetAllergiesRequest: {
        type: "object",
        properties: {
          allergyIds: { type: "array", items: { type: "integer", example: 1 } },
        },
      },
      SetOfficialsRequest: {
        type: "object",
        properties: {
          officialIds: { type: "array", items: { type: "integer", example: 1 } },
        },
      },
      CreateEventRequest: {
        type: "object",
        required: ["title", "description", "startDate", "endDate"],
        properties: {
          title: { type: "string", example: "Founders Meeting" },
          description: { type: "string", example: "Annual founders meeting and dinner." },
          lodgeMeeting: { type: "boolean", nullable: true },
          price: { type: "number", format: "float", example: 275 },
          startDate: { type: "string", example: "2026-03-14 18:00:00" },
          endDate: { type: "string", example: "2026-03-14 21:00:00" },
          lodgeIds: { type: "array", items: { type: "integer", example: 1 } },
        },
      },
      UpdateEventRequest: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          lodgeMeeting: { type: "boolean", nullable: true },
          price: { type: "number", format: "float" },
          startDate: { type: "string" },
          endDate: { type: "string" },
        },
      },
      EventLodgeLinkRequest: {
        type: "object",
        required: ["lodgeId"],
        properties: {
          lodgeId: {
            oneOf: [{ type: "integer", example: 1 }, { type: "string", example: "1" }],
          },
        },
      },
      EventRsvpRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["going", "not-going"], example: "going" },
        },
      },
      EventFoodRequest: {
        type: "object",
        required: ["bookFood"],
        properties: {
          bookFood: { type: "boolean", example: true },
        },
      },
      EventAttendancePatchRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          rsvp: { type: "boolean" },
          bookFood: { type: "boolean" },
          attended: { type: "boolean" },
          paymentPaid: { type: "boolean" },
        },
      },
      CreatePostRequest: {
        type: "object",
        required: ["title", "description", "picture"],
        properties: {
          title: { type: "string", example: "News title" },
          description: { type: "string", example: "Post body" },
          lodgeIds: {
            oneOf: [
              { type: "array", items: { type: "integer", example: 1 } },
              { type: "string", example: "1,2,3" },
            ],
          },
          publicum: {
            oneOf: [
              { type: "boolean", example: true },
              { type: "string", example: "true" },
              { type: "integer", example: 1 },
            ],
          },
          picture: { type: "string", format: "binary" },
        },
      },
      UpdatePostRequest: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          lodgeIds: {
            oneOf: [
              { type: "array", items: { type: "integer" } },
              { type: "string", example: "1,2" },
            ],
          },
          publicum: {
            oneOf: [
              { type: "boolean" },
              { type: "string" },
              { type: "integer" },
            ],
          },
          picture: { type: "string", format: "binary" },
        },
      },
      CreateLodgeRequest: {
        type: "object",
        required: ["name", "city"],
        properties: {
          name: { type: "string", example: "Nova Lodge" },
          city: { type: "string", example: "Malmo" },
          description: { type: "string", nullable: true },
          email: { type: "string", nullable: true },
          picture: { type: "string", nullable: true },
        },
      },
      UpdateLodgeRequest: {
        type: "object",
        properties: {
          name: { type: "string", nullable: true },
          city: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          email: { type: "string", nullable: true },
          picture: { type: "string", nullable: true },
        },
      },
      CreateRevisionRequest: {
        type: "object",
        required: ["title", "year", "lodgeId", "file"],
        properties: {
          title: { type: "string", example: "Stamlogen Revision" },
          year: { type: "integer", example: 2026 },
          lodgeId: { type: "integer", example: 1 },
          file: { type: "string", format: "binary" },
        },
      },
      CreateDocumentRequest: {
        type: "object",
        required: ["title", "file"],
        properties: {
          title: { type: "string", example: "Stadgar 2026" },
          file: { type: "string", format: "binary" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "API health check",
        description: "Returns liveness status used by smoke tests and probes.",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Service is healthy.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
          ...internal,
        },
      },
    },
    "/openapi.json": {
      get: {
        tags: ["Docs"],
        summary: "Get OpenAPI JSON",
        description: "Returns the generated OpenAPI contract as JSON.",
        operationId: "getOpenApiJson",
        responses: {
          "200": {
            description: "OpenAPI JSON document.",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          ...internal,
        },
      },
    },
    "/docs": {
      get: {
        tags: ["Docs"],
        summary: "Swagger UI",
        description: "Interactive Swagger UI generated from `/openapi.json`.",
        operationId: "getSwaggerUi",
        responses: {
          "200": {
            description: "Swagger UI HTML.",
            content: {
              "text/html": {
                schema: { type: "string" },
              },
            },
          },
          ...internal,
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description:
          "Creates a user account. Requires authenticated Admin or Editor and profile picture upload.",
        operationId: "registerUser",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "User created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserWithRolesResponse" },
              },
            },
          },
          ...pictureUploadBadRequest,
          ...unauthorized,
          ...forbidden,
          ...conflict,
          ...rateLimited,
          ...pictureUploadInternal,
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        description:
          "Authenticates with email/password and sets HTTP-only access and refresh cookies.",
        operationId: "login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Login succeeded. Auth cookies are set and session timing metadata is returned.",
            headers: {
              "Set-Cookie": {
                description:
                  `Sets HTTP-only ${ACCESS_COOKIE} and ${REFRESH_COOKIE} cookies.`,
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSessionResponse" },
                example: { session: authSessionExample },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...rateLimited,
          ...internal,
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh session",
        description:
          "Rotates the refresh token and issues fresh auth cookies if the session has not exceeded the inactivity window.",
        operationId: "refreshSession",
        security: [{ refreshCookieAuth: [] }],
        responses: {
          "200": {
            description: "Session refreshed and timing metadata updated.",
            headers: {
              "Set-Cookie": {
                description:
                  `Rotates ${REFRESH_COOKIE} and sets fresh ${ACCESS_COOKIE} cookie.`,
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSessionResponse" },
                example: { session: authSessionExample },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/auth/heartbeat": {
      post: {
        tags: ["Auth"],
        summary: "Heartbeat session",
        description:
          "Keeps an active session alive from the refresh cookie while enforcing the same inactivity window as `/auth/refresh`.",
        operationId: "heartbeatSession",
        security: [{ refreshCookieAuth: [] }],
        responses: {
          "200": {
            description: "Session heartbeat accepted and timing metadata updated.",
            headers: {
              "Set-Cookie": {
                description:
                  `Rotates ${REFRESH_COOKIE} and sets fresh ${ACCESS_COOKIE} cookie.`,
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSessionResponse" },
                example: {
                  session: {
                    ...authSessionExample,
                    inactivityExpiresAt: "2026-03-09T13:16:00.000Z",
                  },
                },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get authenticated user context",
        description:
          "Returns authenticated user profile together with roles, achievements, allergies, and officials.",
        operationId: "getAuthMe",
        security: authSecurity,
        responses: {
          "200": {
            description: "Current authentication context.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthContextResponse" },
                example: {
                  user: {
                    matrikelnummer: 7,
                    email: "admin@example.com",
                    firstname: "Admin",
                    lastname: "Example",
                    allergies: [],
                    officials: [],
                    officialHistory: [],
                  },
                  roles: ["Admin"],
                  achievements: [],
                  allergies: [],
                  officials: [],
                  officialHistory: [],
                  session: authSessionExample,
                },
              },
            },
          },
          ...unauthorized,
          ...notFound,
          ...internal,
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout current session",
        description:
          "Revokes current session tokens and clears auth cookies on this device.",
        operationId: "logout",
        security: authSecurity,
        responses: {
          "200": {
            description: "Session logged out.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
                example: { message: "Utloggad från den här enheten" },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/auth/revoke-all": {
      post: {
        tags: ["Auth"],
        summary: "Revoke all sessions",
        description: "Revokes all sessions for the authenticated user.",
        operationId: "revokeAllSessions",
        security: authSecurity,
        responses: {
          "200": {
            description: "All sessions revoked.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
                example: { message: "Alla sessioner har återkallats" },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current user profile",
        description: "Returns authenticated user's public profile data.",
        operationId: "getUsersMe",
        security: authSecurity,
        responses: {
          "200": {
            description: "Current user profile.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicUserResponse" },
              },
            },
          },
          ...unauthorized,
          ...notFound,
          ...internal,
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update current user profile",
        description: "Updates current authenticated user profile fields.",
        operationId: "updateUsersMe",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateUserProfileRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated profile.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicUserResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...notFound,
          ...internal,
        },
      },
    },
    "/users/me/attended": {
      get: {
        tags: ["Users"],
        summary: "Get current user's attended events",
        description:
          "Returns attended event history and aggregate counters for current user.",
        operationId: "getUsersMeAttended",
        security: authSecurity,
        responses: {
          "200": {
            description: "Attendance summary.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AttendedEventsSummary" },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/users/me/picture": {
      post: {
        tags: ["Users"],
        summary: "Update current user profile picture",
        description: "Uploads and sets a new profile picture for current user.",
        operationId: "postUsersMePicture",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["picture"],
                properties: {
                  picture: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile picture updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PictureUploadResponse" },
              },
            },
          },
          ...pictureUploadBadRequest,
          ...unauthorized,
          ...pictureUploadInternal,
        },
      },
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "List users",
        description:
          "Lists users with optional filtering by name, achievement, lodge, official, and accommodation availability.",
        operationId: "listUsers",
        security: authSecurity,
        parameters: [
          {
            in: "query",
            name: "name",
            required: false,
            schema: { type: "string" },
            example: "Viktor",
          },
          {
            in: "query",
            name: "achievementId",
            required: false,
            schema: { type: "integer" },
            example: 1,
          },
          {
            in: "query",
            name: "lodgeId",
            required: false,
            schema: { type: "integer" },
            example: 2,
          },
          {
            in: "query",
            name: "officialId",
            required: false,
            schema: { type: "integer" },
            example: 3,
          },
          {
            in: "query",
            name: "accommodationAvailable",
            required: false,
            schema: {
              oneOf: [
                { type: "boolean" },
                { type: "string", enum: ["true", "false", "1", "0"] },
              ],
            },
            example: "true",
          },
        ],
        responses: {
          "200": {
            description: "User list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: {
                      type: "array",
                      items: { $ref: "#/components/schemas/PublicUser" },
                    },
                  },
                },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/users/map": {
      get: {
        tags: ["Users"],
        summary: "List user map pins",
        description: "Returns map pin data used in map views.",
        operationId: "getUsersMap",
        security: authSecurity,
        responses: {
          "200": {
            description: "Map pin rows.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: {
                      type: "array",
                      items: { $ref: "#/components/schemas/UserMapPin" },
                    },
                  },
                },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/users/{matrikelnummer}": {
      get: {
        tags: ["Users"],
        summary: "Get user profile by matrikelnummer",
        description:
          "Returns target user's public profile with achievements/allergies/officials history.",
        operationId: "getUserByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        responses: {
          "200": {
            description: "Target user profile.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicUserProfileResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...notFound,
          ...internal,
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update another user's profile",
        description: "Updates target user profile (Admin/Editor).",
        operationId: "putUserByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateUserProfileRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Target user updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicUserResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...notFound,
          ...internal,
        },
      },
    },
    "/users/{matrikelnummer}/attended": {
      get: {
        tags: ["Users"],
        summary: "Get attended events for a user",
        description: "Returns attended events summary for target user.",
        operationId: "getUserAttendedByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        responses: {
          "200": {
            description: "Attendance summary for target user.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AttendedEventsSummary" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/users/{matrikelnummer}/location": {
      put: {
        tags: ["Users"],
        summary: "Set user location override",
        description: "Sets manual lat/lng for target user (self or Admin/Editor).",
        operationId: "putUserLocationByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SetUserLocationRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Location override saved.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/users/{matrikelnummer}/location-override": {
      delete: {
        tags: ["Users"],
        summary: "Clear user location override",
        description: "Clears manual location override (self or Admin/Editor).",
        operationId: "deleteUserLocationOverrideByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        responses: {
          "200": {
            description: "Location override cleared.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/users/{matrikelnummer}/picture": {
      post: {
        tags: ["Users"],
        summary: "Update another user's profile picture",
        description: "Uploads profile picture for target user (Admin/Editor).",
        operationId: "postUserPictureByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["picture"],
                properties: { picture: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile picture updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PictureUploadResponse" },
              },
            },
          },
          ...pictureUploadBadRequest,
          ...unauthorized,
          ...forbidden,
          ...pictureUploadInternal,
        },
      },
    },
    "/users/{matrikelnummer}/achievements": {
      post: {
        tags: ["Users"],
        summary: "Award user achievement",
        description: "Assigns achievement to target user (Admin/Editor).",
        operationId: "postUserAchievementByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddAchievementRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Achievement assigned.",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessWithIdResponse" },
                    {
                      type: "object",
                      properties: {
                        awardedAt: { type: "string", format: "date-time", nullable: true },
                      },
                    },
                  ],
                },
              },
            },
          },
          ...pictureUploadBadRequest,
          ...unauthorized,
          ...forbidden,
          ...pictureUploadInternal,
        },
      },
      get: {
        tags: ["Users"],
        summary: "Get user achievements",
        description: "Returns achievements for target user.",
        operationId: "getUserAchievementsByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        responses: {
          "200": {
            description: "Achievement list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    achievements: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Achievement" },
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/users/{matrikelnummer}/roles": {
      get: {
        tags: ["Users"],
        summary: "Get user roles",
        description: "Returns role assignments for target user (Admin/Editor).",
        operationId: "getUserRolesByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        responses: {
          "200": {
            description: "Role list.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleValuesResponse" },
              },
            },
          },
          ...pictureUploadBadRequest,
          ...unauthorized,
          ...forbidden,
          ...pictureUploadInternal,
        },
      },
      post: {
        tags: ["Users"],
        summary: "Set user roles",
        description: "Sets role ids for target user (Admin only).",
        operationId: "postUserRolesByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SetRolesRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Roles updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...fileUploadBadRequest,
          ...unauthorized,
          ...forbidden,
          ...fileUploadInternal,
        },
      },
    },
    "/users/{matrikelnummer}/lodges": {
      get: {
        tags: ["Users"],
        summary: "Get user's lodge assignment",
        description: "Returns target user's current lodge assignment.",
        operationId: "getUserLodgesByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        responses: {
          "200": {
            description: "Lodge assignment.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    lodge: {
                      anyOf: [
                        { $ref: "#/components/schemas/Lodge" },
                        { type: "null" },
                      ],
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...internal,
        },
      },
      post: {
        tags: ["Users"],
        summary: "Set user's lodge assignment",
        description: "Sets or clears target user's lodge (Admin/Editor).",
        operationId: "postUserLodgesByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SetLodgeRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Lodge assignment updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...fileUploadBadRequest,
          ...unauthorized,
          ...forbidden,
          ...fileUploadInternal,
        },
      },
    },
    "/events": {
      get: {
        tags: ["Events"],
        summary: "List events",
        description: "Lists events for authenticated users.",
        operationId: "getEvents",
        security: authSecurity,
        responses: {
          "200": {
            description: "Event list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    events: {
                      type: "array",
                      items: { $ref: "#/components/schemas/EventSummary" },
                    },
                  },
                },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
      post: {
        tags: ["Events"],
        summary: "Create event",
        description: "Creates a new event (Admin/Editor).",
        operationId: "postEvents",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateEventRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Event created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessWithIdResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/events/upcoming": {
      get: {
        tags: ["Events"],
        summary: "List upcoming events (public)",
        description:
          "Public endpoint for upcoming events. Query parameter `limit` is clamped between 1 and 50.",
        operationId: "getUpcomingEvents",
        parameters: [
          {
            in: "query",
            name: "limit",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 50 },
            example: 10,
          },
        ],
        responses: {
          "200": {
            description: "Upcoming event list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    events: {
                      type: "array",
                      items: { $ref: "#/components/schemas/EventSummary" },
                    },
                  },
                },
              },
            },
          },
          ...internal,
        },
      },
    },
    "/events/mine": {
      get: {
        tags: ["Events"],
        summary: "List events visible to current user",
        description: "Lists events visible for the authenticated user by membership.",
        operationId: "getMyEvents",
        security: authSecurity,
        responses: {
          "200": {
            description: "Visible event list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    events: {
                      type: "array",
                      items: { $ref: "#/components/schemas/EventSummary" },
                    },
                  },
                },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/events/{id}": {
      get: {
        tags: ["Events"],
        summary: "Get event by id",
        description: "Returns one event by id.",
        operationId: "getEventById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Event details.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { event: { $ref: "#/components/schemas/EventSummary" } },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...notFound,
          ...internal,
        },
      },
      put: {
        tags: ["Events"],
        summary: "Update event",
        description: "Updates event fields (Admin/Editor).",
        operationId: "putEventById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateEventRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Event updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
      delete: {
        tags: ["Events"],
        summary: "Delete event",
        description: "Deletes event by id (Admin only).",
        operationId: "deleteEventById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Event deleted.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/events/{id}/lodges": {
      get: {
        tags: ["Events"],
        summary: "List lodges linked to event",
        description: "Returns lodges linked to the target event.",
        operationId: "getEventLodgesById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Linked lodge list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    lodges: {
                      type: "array",
                      items: { $ref: "#/components/schemas/LodgeReference" },
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...internal,
        },
      },
      post: {
        tags: ["Events"],
        summary: "Link lodge to event",
        description: "Adds lodge-event link (Admin/Editor).",
        operationId: "postEventLodgesById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EventLodgeLinkRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Lodge linked.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
      delete: {
        tags: ["Events"],
        summary: "Unlink lodge from event",
        description:
          "Removes lodge-event link (Admin/Editor). `lodgeId` can be provided via query or body.",
        operationId: "deleteEventLodgesById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
          {
            in: "query",
            name: "lodgeId",
            required: false,
            schema: { type: "integer" },
            example: 2,
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EventLodgeLinkRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Lodge unlinked.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/events/{id}/rsvp": {
      post: {
        tags: ["Events"],
        summary: "Set RSVP for current user",
        description: "Sets RSVP status (`going` or `not-going`) for current user.",
        operationId: "postEventRsvpById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EventRsvpRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "RSVP set.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    status: { type: "string", enum: ["going", "not-going"] },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...notFound,
          ...internal,
        },
      },
      get: {
        tags: ["Events"],
        summary: "Get RSVP for current user",
        description: "Returns current user's RSVP status for the event.",
        operationId: "getEventRsvpById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "RSVP status.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    rsvp: {
                      type: "string",
                      nullable: true,
                      enum: ["going", "not-going", null],
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/events/{id}/food": {
      get: {
        tags: ["Events"],
        summary: "Get food booking state",
        description:
          "Returns current user's food booking state. Returns `null` when event has no food booking.",
        operationId: "getEventFoodById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Food booking status.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    bookFood: {
                      oneOf: [{ type: "boolean" }, { type: "null" }],
                      example: true,
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...notFound,
          ...internal,
        },
      },
      post: {
        tags: ["Events"],
        summary: "Set food booking state",
        description:
          "Sets current user's food booking state (`bookFood`) for event.",
        operationId: "postEventFoodById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EventFoodRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Food booking updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    bookFood: { type: "boolean", example: true },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...notFound,
          ...internal,
        },
      },
    },
    "/events/{id}/attendances": {
      get: {
        tags: ["Events"],
        summary: "List event attendances",
        description: "Returns attendance rows for users invited to event.",
        operationId: "getEventAttendancesById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Attendance rows.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    attendances: {
                      type: "array",
                      items: { $ref: "#/components/schemas/EventAttendance" },
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...notFound,
          ...internal,
        },
      },
    },
    "/events/{id}/attendances/{uid}": {
      patch: {
        tags: ["Events"],
        summary: "Patch event attendance row",
        description:
          "Admin endpoint to patch `rsvp/bookFood/attended/paymentPaid` for one user attendance row.",
        operationId: "patchEventAttendanceByIdAndUid",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
          {
            in: "path",
            name: "uid",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EventAttendancePatchRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Attendance row updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    row: { $ref: "#/components/schemas/EventAttendance" },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...notFound,
          ...internal,
        },
      },
    },
    "/posts": {
      get: {
        tags: ["Posts"],
        summary: "List posts",
        description:
          "Lists authenticated posts. Optional filters: `lodgeId` and `title`.",
        operationId: "getPosts",
        security: authSecurity,
        parameters: [
          {
            in: "query",
            name: "lodgeId",
            required: false,
            schema: {
              oneOf: [
                { type: "integer" },
                { type: "string", example: "1,2" },
                { type: "array", items: { type: "integer" } },
              ],
            },
            example: "1,2",
          },
          {
            in: "query",
            name: "title",
            required: false,
            schema: { type: "string" },
            example: "welcome",
          },
        ],
        responses: {
          "200": {
            description: "Post list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    posts: {
                      type: "array",
                      items: { $ref: "#/components/schemas/PostSummary" },
                    },
                  },
                },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
      post: {
        tags: ["Posts"],
        summary: "Create post",
        description:
          "Creates new post (Admin/Editor). Accepts multipart form with required picture.",
        operationId: "postPosts",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/CreatePostRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Post created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessWithIdResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/posts/publicum": {
      get: {
        tags: ["Posts"],
        summary: "List public posts",
        description: "Public endpoint listing publicum posts.",
        operationId: "getPublicumPosts",
        responses: {
          "200": {
            description: "Public post list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    posts: {
                      type: "array",
                      items: { $ref: "#/components/schemas/PostSummary" },
                    },
                  },
                },
              },
            },
          },
          ...internal,
        },
      },
    },
    "/posts/{id}": {
      get: {
        tags: ["Posts"],
        summary: "Get post by id",
        description: "Returns one post by id.",
        operationId: "getPostById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Post details.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { post: { $ref: "#/components/schemas/PostDetail" } },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...notFound,
          ...internal,
        },
      },
      put: {
        tags: ["Posts"],
        summary: "Update post",
        description: "Updates post content atomically (Admin/Editor).",
        operationId: "putPostById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/UpdatePostRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Post updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
      delete: {
        tags: ["Posts"],
        summary: "Delete post",
        description: "Deletes post (Admin only).",
        operationId: "deletePostById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Post deleted.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/lodges": {
      get: {
        tags: ["Lodges"],
        summary: "List lodges",
        description:
          "Returns all lodges. Current runtime behavior exposes this endpoint publicly.",
        operationId: "getLodges",
        responses: {
          "200": {
            description: "Lodge list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    lodges: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Lodge" },
                    },
                  },
                },
              },
            },
          },
          ...internal,
        },
      },
      post: {
        tags: ["Lodges"],
        summary: "Create lodge",
        description: "Creates a lodge (Admin only).",
        operationId: "postLodges",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateLodgeRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Lodge created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessWithIdResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/lodges/{id}": {
      get: {
        tags: ["Lodges"],
        summary: "Get lodge by id",
        description:
          "Returns one lodge by id. Current runtime behavior exposes this endpoint publicly.",
        operationId: "getLodgeById",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Lodge details.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { lodge: { $ref: "#/components/schemas/Lodge" } },
                },
              },
            },
          },
          ...badRequest,
          ...notFound,
          ...internal,
        },
      },
      put: {
        tags: ["Lodges"],
        summary: "Update lodge",
        description: "Updates lodge fields (Admin only).",
        operationId: "putLodgeById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateLodgeRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Lodge updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/admin/roles": {
      get: {
        tags: ["Admin"],
        summary: "List available roles",
        description: "Returns role catalogue (Admin only).",
        operationId: "getAdminRoles",
        security: authSecurity,
        responses: {
          "200": {
            description: "Role catalogue.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    roles: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Role" },
                    },
                  },
                },
              },
            },
          },
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/payments/membership": {
      get: {
        tags: ["Payments"],
        summary: "Get current user's membership payments",
        description: "Returns membership payment rows for authenticated user.",
        operationId: "getPaymentsMembership",
        security: authSecurity,
        parameters: [
          {
            in: "query",
            name: "year",
            required: false,
            schema: { type: "integer" },
            example: 2026,
          },
        ],
        responses: {
          "200": {
            description: "Membership payment rows.",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/MembershipPayment" },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/officials": {
      get: {
        tags: ["Officials"],
        summary: "List officials",
        description: "Public endpoint listing official types.",
        operationId: "getOfficials",
        responses: {
          "200": {
            description: "Official list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    officials: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Official" },
                    },
                  },
                },
              },
            },
          },
          ...internal,
        },
      },
    },
    "/officials/member/{matrikelnummer}": {
      put: {
        tags: ["Officials"],
        summary: "Set member officials",
        description:
          "Sets official assignments for target member (Admin/Editor) and returns current officials plus official history.",
        operationId: "putOfficialsMemberByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SetOfficialsRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Officials updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    officials: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Official" },
                    },
                    officialHistory: {
                      type: "array",
                      items: { $ref: "#/components/schemas/OfficialHistory" },
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/allergies": {
      get: {
        tags: ["Allergies"],
        summary: "List allergies",
        description: "Public endpoint listing allergy types.",
        operationId: "getAllergies",
        responses: {
          "200": {
            description: "Allergy list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    allergies: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Allergy" },
                    },
                  },
                },
              },
            },
          },
          ...internal,
        },
      },
    },
    "/allergies/member/{matrikelnummer}": {
      put: {
        tags: ["Allergies"],
        summary: "Set member allergies",
        description:
          "Sets allergy assignments for target member (self or Admin/Editor).",
        operationId: "putAllergiesMemberByMatrikelnummer",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "matrikelnummer",
            required: true,
            schema: { type: "integer" },
            example: 7,
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SetAllergiesRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Allergies updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    allergies: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Allergy" },
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/revisions": {
      get: {
        tags: ["Revisions"],
        summary: "List revisions",
        description: "Lists revisions with optional filters (`year`, `lodgeId`).",
        operationId: "getRevisions",
        security: authSecurity,
        parameters: [
          {
            in: "query",
            name: "year",
            required: false,
            schema: { type: "integer", minimum: 1900, maximum: 3000 },
            example: 2026,
          },
          {
            in: "query",
            name: "lodgeId",
            required: false,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
        ],
        responses: {
          "200": {
            description: "Revision list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    revisions: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Revision" },
                    },
                  },
                },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...internal,
        },
      },
      post: {
        tags: ["Revisions"],
        summary: "Create revision",
        description: "Uploads a revision PDF and creates revision record (Admin/Editor).",
        operationId: "postRevisions",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/CreateRevisionRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Revision created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessWithIdResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/documents": {
      get: {
        tags: ["Documents"],
        summary: "List documents",
        description: "Lists documents for authenticated users.",
        operationId: "getDocuments",
        security: authSecurity,
        responses: {
          "200": {
            description: "Document list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    documents: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Document" },
                    },
                  },
                },
              },
            },
          },
          ...unauthorized,
          ...internal,
        },
      },
      post: {
        tags: ["Documents"],
        summary: "Create document",
        description: "Uploads a document PDF and creates document record (Admin/Editor).",
        operationId: "postDocuments",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/CreateDocumentRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Document created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessWithIdResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...internal,
        },
      },
    },
    "/achievements": {
      get: {
        tags: ["Achievements"],
        summary: "List achievements",
        description: "Public endpoint listing achievement types.",
        operationId: "getAchievements",
        responses: {
          "200": {
            description: "Achievement list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    achievements: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Achievement" },
                    },
                  },
                },
              },
            },
          },
          ...internal,
        },
      },
    },
  },
};

export default swaggerSpec;
