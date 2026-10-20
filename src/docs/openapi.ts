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
    { name: "Groups", description: "Group listing, management and membership." },
    { name: "Admin", description: "Admin utilities." },
    { name: "Payments", description: "Membership payment endpoints." },
    { name: "Officials", description: "Officials catalogue and assignments." },
    { name: "Allergies", description: "Allergies catalogue and assignments." },
    { name: "Revisions", description: "Revision listing and upload endpoints." },
    { name: "Documents", description: "Document listing and upload endpoints." },
    { name: "Achievements", description: "Achievement catalogue endpoints." },
    { name: "Media", description: "Authenticated media serving and public placeholders." },
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
      Group: {
        type: "object",
        required: ["id", "name", "userIds", "memberCount"],
        properties: {
          id: { type: "integer", example: 5 },
          name: { type: "string", example: "Planeringsgruppen" },
          description: { type: "string", nullable: true },
          userIds: {
            type: "array",
            items: { type: "integer", example: 1 },
          },
          memberCount: {
            type: "integer",
            example: 3,
            description: "Number of members (equals userIds.length).",
          },
        },
      },
      GroupMember: {
        type: "object",
        required: ["matrikelnummer", "firstname", "lastname", "email", "archive"],
        properties: {
          matrikelnummer: { type: "integer", example: 7 },
          firstname: { type: "string", example: "Anders" },
          lastname: { type: "string", example: "Andersson" },
          email: { type: "string", format: "email", example: "anders@example.com" },
          archive: {
            type: "string",
            nullable: true,
            enum: ["Avliden", "Urgången", "Avförd", null],
          },
        },
      },
      CreateGroupRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", maxLength: 255, example: "Planeringsgruppen" },
          description: {
            type: "string",
            nullable: true,
            maxLength: 2000,
            example: "Grupp för planering av gemensamma möten.",
          },
        },
      },
      UpdateGroupRequest: {
        type: "object",
        description: "At least one of name or description must be provided.",
        properties: {
          name: { type: "string", maxLength: 255, example: "Planeringsgruppen" },
          description: { type: "string", nullable: true, maxLength: 2000 },
        },
      },
      GroupMutationResponse: {
        type: "object",
        required: ["success", "group"],
        properties: {
          success: { type: "boolean", example: true },
          id: { type: "integer", example: 12, description: "Present on create." },
          group: { $ref: "#/components/schemas/Group" },
        },
      },
      AddGroupMembersRequest: {
        type: "object",
        required: ["userIds"],
        properties: {
          userIds: {
            type: "array",
            minItems: 1,
            maxItems: 500,
            items: { type: "integer", example: 7 },
          },
        },
      },
      AddGroupMembersResponse: {
        type: "object",
        required: ["success", "added", "alreadyMembers"],
        properties: {
          success: { type: "boolean", example: true },
          added: { type: "array", items: { type: "integer" }, example: [7, 9] },
          alreadyMembers: {
            type: "array",
            items: { type: "integer" },
            example: [12],
          },
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
          feeExempt: {
            type: "boolean",
            description:
              "\"Befriad från årsavgift\". Only included for Admin/Editor callers (GET and PUT /users/{matrikelnummer}). When true, the yearly job creates no membership payment for the user.",
            example: false,
          },
          standingList: {
            type: "boolean",
            description:
              "\"Ständiga listan\". Only included for Admin/Editor callers (GET and PUT /users/{matrikelnummer}). When true, the user is prefilled as attending (and booked for food when the event has food) on events created with the user in their audience.",
            example: false,
          },
        },
      },
      PublicUserResponse: {
        type: "object",
        required: ["user"],
        properties: {
          user: { $ref: "#/components/schemas/PublicUser" },
        },
      },
      PaginationMeta: {
        type: "object",
        required: ["page", "pageSize", "total", "totalPages"],
        properties: {
          page: { type: "integer", minimum: 1, example: 1 },
          pageSize: { type: "integer", minimum: 1, example: 24 },
          total: { type: "integer", minimum: 0, example: 128 },
          totalPages: { type: "integer", minimum: 0, example: 6 },
        },
      },
      PublicUserListResponse: {
        allOf: [
          { $ref: "#/components/schemas/PaginationMeta" },
          {
            type: "object",
            required: ["users"],
            properties: {
              users: {
                type: "array",
                items: { $ref: "#/components/schemas/PublicUser" },
              },
            },
          },
        ],
      },
      PublicUserProfileResponse: {
        type: "object",
        required: ["user", "achievements", "allergies", "officials", "officialHistory"],
        properties: {
          user: { $ref: "#/components/schemas/PublicUser" },
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
          user: { $ref: "#/components/schemas/PublicUser" },
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
          lodgeIds: {
            type: "array",
            items: { type: "integer", example: 1 },
          },
          groupIds: {
            type: "array",
            items: { type: "integer", example: 5 },
          },
          userIds: {
            type: "array",
            items: { type: "integer", example: 24 },
          },
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
      MembershipPaymentsResponse: {
        type: "object",
        required: ["payments"],
        properties: {
          payments: {
            type: "array",
            items: { $ref: "#/components/schemas/MembershipPayment" },
          },
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
      ForgotPasswordRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "member@example.com",
          },
        },
      },
      VerifyPasswordActionRequest: {
        type: "object",
        required: ["token"],
        properties: {
          token: {
            type: "string",
            example: "c6c6160bf2e14d36b6e9e4302f7cd498",
          },
        },
      },
      CompletePasswordActionRequest: {
        type: "object",
        required: ["token", "password"],
        properties: {
          token: {
            type: "string",
            example: "c6c6160bf2e14d36b6e9e4302f7cd498",
          },
          password: {
            type: "string",
            format: "password",
            example: "nyttlosen123",
          },
        },
      },
      PasswordActionPurpose: {
        type: "string",
        enum: ["SET_PASSWORD", "RESET_PASSWORD"],
        example: "RESET_PASSWORD",
      },
      PasswordActionStatusResponse: {
        type: "object",
        required: ["purpose", "email", "expiresAt"],
        properties: {
          purpose: { $ref: "#/components/schemas/PasswordActionPurpose" },
          email: {
            type: "string",
            format: "email",
            example: "member@example.com",
          },
          expiresAt: {
            type: "string",
            format: "date-time",
            example: "2026-06-09T10:15:00.000Z",
          },
        },
      },
      RegisterRequest: {
        type: "object",
        required: [
          "email",
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
          allergyIds: {
            type: "array",
            items: { type: "integer", example: 1 },
            example: [1, 3],
          },
          picture: { type: "string", format: "binary" },
        },
      },
      RegisterUserResponse: {
        allOf: [
          { $ref: "#/components/schemas/UserWithRolesResponse" },
          {
            type: "object",
            required: ["inviteEmailSent"],
            properties: {
              inviteEmailSent: {
                type: "boolean",
                example: true,
              },
            },
          },
        ],
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
          feeExempt: {
            type: "boolean",
            description:
              "Admin/Editor only, via PUT /users/{matrikelnummer}. Sending it to PUT /users/me returns 403. Must be a boolean (null is rejected with details.fields.feeExempt).",
          },
          standingList: {
            type: "boolean",
            description:
              "Admin/Editor only, via PUT /users/{matrikelnummer}. Sending it to PUT /users/me returns 403. Must be a boolean (null is rejected with details.fields.standingList).",
          },
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
          groupIds: { type: "array", items: { type: "integer", example: 5 } },
          userIds: { type: "array", items: { type: "integer", example: 24 } },
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
          lodgeIds: { type: "array", items: { type: "integer" } },
          groupIds: { type: "array", items: { type: "integer" } },
          userIds: { type: "array", items: { type: "integer" } },
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
      EventRegistrationRequest: {
        type: "object",
        required: ["rsvp"],
        properties: {
          rsvp: {
            type: "boolean",
            description: "`true` = kommer, `false` = kommer inte.",
            example: true,
          },
          bookFood: {
            type: "boolean",
            description:
              "Äter / äter inte. Defaults to `false`. Forced to `false` when `rsvp` is `false` or the event has no food.",
            example: true,
          },
        },
      },
      EventRegistration: {
        type: "object",
        properties: {
          rsvp: {
            type: "boolean",
            nullable: true,
            description: "`null` when the member has not answered yet.",
            example: true,
          },
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
          "Creates a member onboarding record in one request. Requires authenticated Admin or Editor and profile picture upload. The backend persists roles, lodge, allergies, current-year membership payment, and the default achievement before commit, then sends an email that lets the member choose their own password.",
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
                schema: { $ref: "#/components/schemas/RegisterUserResponse" },
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
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset email",
        description:
          "Accepts an email address and, when a matching account exists, sends a one-time link that lets the member choose a new password. The success response is intentionally generic.",
        operationId: "forgotPassword",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ForgotPasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Generic success response regardless of account match.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
                example: {
                  message:
                    "Om e-postadressen finns registrerad skickar vi ett mejl med en länk för att välja ett nytt lösenord.",
                },
              },
            },
          },
          ...badRequest,
          ...rateLimited,
          ...internal,
        },
      },
    },
    "/auth/password-actions/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify password action link",
        description:
          "Checks whether a password setup or reset token is still valid and returns the associated account metadata needed by the UI.",
        operationId: "verifyPasswordAction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyPasswordActionRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Password action token is valid.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PasswordActionStatusResponse" },
              },
            },
          },
          ...badRequest,
          ...rateLimited,
          ...internal,
        },
      },
    },
    "/auth/password-actions/complete": {
      post: {
        tags: ["Auth"],
        summary: "Complete password setup or reset",
        description:
          "Consumes a valid one-time token, stores the new password, and revokes existing sessions for that member.",
        operationId: "completePasswordAction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CompletePasswordActionRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Password updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
                example: { message: "Lösenordet har uppdaterats" },
              },
            },
          },
          ...badRequest,
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
        description:
          "Updates current authenticated user profile fields. The Admin/Editor-only fields `feeExempt` and `standingList` are rejected with 403.",
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
          ...forbidden,
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
          "Lists users with optional filtering. Any authenticated member may access the member directory, including contact details and allergies. Access is audit-logged.",
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
          {
            in: "query",
            name: "page",
            required: false,
            schema: { type: "integer", minimum: 1, default: 1 },
            example: 1,
          },
          {
            in: "query",
            name: "pageSize",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 24,
            },
            example: 24,
          },
        ],
        responses: {
          "200": {
            description: "Paginated user list.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicUserListResponse" },
                example: {
                  users: [
                    {
                      matrikelnummer: 77,
                      email: "ny.medlem@example.com",
                      firstname: "Ny",
                      lastname: "Medlem",
                      city: "Karlskrona",
                    },
                  ],
                  page: 1,
                  pageSize: 24,
                  total: 128,
                  totalPages: 6,
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
          "Returns a member-directory profile for any authenticated member, including email, contact details, achievements, allergies, and officials history. For Admin/Editor callers the user object also includes `feeExempt` and `standingList`.",
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
                example: {
                  user: {
                    matrikelnummer: 7,
                    email: "admin@example.com",
                    firstname: "Admin",
                    lastname: "Example",
                    dateOfBirth: "1900-01-01",
                    mobile: "0707070707",
                    city: "Stockholm",
                    address: "Storgatan 1",
                    zipcode: "22233",
                    picture: null,
                    pictureUrl: null,
                  },
                  achievements: [],
                  allergies: [],
                  officials: [],
                  officialHistory: [],
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
        tags: ["Users"],
        summary: "Update another user's profile",
        description:
          "Updates target user profile (Admin/Editor), including the flags `feeExempt` (Befriad från årsavgift) and `standingList` (Ständiga listan). The response user includes both flags.",
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
        description:
          "Creates a new event (Admin/Editor). Every invited user (lodge members, group members and directly selected users) gets an attendance row. Invited, non-archived users with `standingList` = true are prefilled with rsvp = going and bookFood = true when the event has food (price > 0); everyone else starts unanswered. The prefill only happens on creation; later audience changes and flag changes do not prefill.",
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
    "/events/{id}/registration": {
      get: {
        tags: ["Events"],
        summary: "Get current user's registration",
        description:
          "Returns the current user's attendance + food registration for the event (e.g. values prefilled from the standing list). `bookFood` is always `false` for events without food. Requires that the caller is invited to the event.",
        operationId: "getEventRegistrationById",
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
            description: "Current registration.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    registration: {
                      $ref: "#/components/schemas/EventRegistration",
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
      put: {
        tags: ["Events"],
        summary: "Save current user's registration",
        description:
          "Atomically saves attendance (`rsvp`) and food (`bookFood`) for the current user in one write. `bookFood` is forced to `false` when `rsvp` is `false` or the event has no food. Same rules as `/rsvp`: the caller must be invited and the event must not have started. Payment is not handled here.",
        operationId: "putEventRegistrationById",
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
              schema: { $ref: "#/components/schemas/EventRegistrationRequest" },
              example: { rsvp: true, bookFood: true },
            },
          },
        },
        responses: {
          "200": {
            description: "Registration saved; returns the stored state.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    registration: {
                      $ref: "#/components/schemas/EventRegistration",
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
    },
    "/events/{id}/attendances": {
      get: {
        tags: ["Events"],
        summary: "List event attendances",
        description:
          "Returns attendance rows for an event. Requires Admin or Editor role, or that the caller is invited to the event.",
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
          ...forbidden,
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
    "/groups": {
      get: {
        tags: ["Groups"],
        summary: "List groups",
        description:
          "Returns all groups with their member user ids and member count.",
        operationId: "getGroups",
        security: authSecurity,
        responses: {
          "200": {
            description: "Group list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    groups: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Group" },
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
        tags: ["Groups"],
        summary: "Create group",
        description:
          "Creates a group (Admin/Editor). Names are compared case-insensitively; a duplicate name returns 409 with `details.fields.name`.",
        operationId: "postGroups",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateGroupRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Group created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GroupMutationResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...conflict,
          ...internal,
        },
      },
    },
    "/groups/{id}": {
      get: {
        tags: ["Groups"],
        summary: "Get group",
        description: "Returns one group with member ids and member count.",
        operationId: "getGroupById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 5,
          },
        ],
        responses: {
          "200": {
            description: "Group.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { group: { $ref: "#/components/schemas/Group" } },
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
        tags: ["Groups"],
        summary: "Update group",
        description:
          "Renames a group and/or updates its description (Admin/Editor). The duplicate-name check only runs when the name changes.",
        operationId: "putGroupById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 5,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateGroupRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Group updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GroupMutationResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...forbidden,
          ...notFound,
          ...conflict,
          ...internal,
        },
      },
      delete: {
        tags: ["Groups"],
        summary: "Delete group",
        description:
          "Deletes a group (Admin/Editor). Memberships and event-audience links are removed via FK cascade.",
        operationId: "deleteGroupById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 5,
          },
        ],
        responses: {
          "200": {
            description: "Group deleted.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
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
    "/groups/{id}/members": {
      get: {
        tags: ["Groups"],
        summary: "List group members",
        description:
          "Returns the members of a group sorted by last name. Archived users are included with their `archive` value.",
        operationId: "getGroupMembersById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 5,
          },
        ],
        responses: {
          "200": {
            description: "Member list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    members: {
                      type: "array",
                      items: { $ref: "#/components/schemas/GroupMember" },
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
      post: {
        tags: ["Groups"],
        summary: "Add group members",
        description:
          "Adds one or more users to a group (Admin/Editor). Idempotent: users already in the group are returned in `alreadyMembers`. Unknown users fail the request with `details.fields.userIds`.",
        operationId: "postGroupMembersById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 5,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddGroupMembersRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Members added.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AddGroupMembersResponse" },
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
    "/groups/{id}/members/{matrikelnummer}": {
      delete: {
        tags: ["Groups"],
        summary: "Remove group member",
        description:
          "Removes one user from a group (Admin/Editor). Returns 404 when the group does not exist or the user is not a member.",
        operationId: "deleteGroupMemberById",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 5,
          },
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
            description: "Member removed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
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
                schema: { $ref: "#/components/schemas/MembershipPaymentsResponse" },
              },
            },
          },
          ...badRequest,
          ...unauthorized,
          ...internal,
        },
      },
    },
    "/payments/membership/admin": {
      get: {
        tags: ["Payments"],
        summary: "List all membership payments (Admin)",
        description: "Returns paginated membership payment rows for admin review.",
        operationId: "getPaymentsMembershipAdmin",
        security: authSecurity,
        parameters: [
          {
            in: "query",
            name: "page",
            required: false,
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
          {
            in: "query",
            name: "pageSize",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100 },
            example: 50,
          },
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
            description: "Paginated membership payment rows.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    payments: {
                      type: "array",
                      items: { $ref: "#/components/schemas/MembershipPayment" },
                    },
                    page: { type: "integer" },
                    pageSize: { type: "integer" },
                    total: { type: "integer" },
                    totalPages: { type: "integer" },
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
    "/payments/membership/{id}/status": {
      patch: {
        tags: ["Payments"],
        summary: "Update membership payment status (Admin)",
        description: "Sets membership payment status to Pending or Paid.",
        operationId: "patchPaymentsMembershipStatus",
        security: authSecurity,
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            example: 12,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["Pending", "Paid"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated membership payment.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    payment: { $ref: "#/components/schemas/MembershipPayment" },
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
    "/media/{id}": {
      get: {
        tags: ["Media"],
        summary: "Get media asset by id",
        description:
          "Returns binary media content. Requires authentication. Cache-Control is private.",
        operationId: "getMediaById",
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
            description: "Binary media content.",
            content: {
              "application/octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          ...unauthorized,
          ...notFound,
          ...internal,
        },
      },
    },
    "/media/placeholders/{type}": {
      get: {
        tags: ["Media"],
        summary: "Get media placeholder asset",
        description: "Public placeholder image or PDF for profile, post, document, or revision types.",
        operationId: "getMediaPlaceholder",
        parameters: [
          {
            in: "path",
            name: "type",
            required: true,
            schema: {
              type: "string",
              enum: ["profile", "post", "document", "revision", "lodge"],
            },
            example: "profile",
          },
        ],
        responses: {
          "200": {
            description: "Placeholder binary content.",
            content: {
              "application/octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
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
