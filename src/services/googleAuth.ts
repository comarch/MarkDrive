import { DriveUser } from "../types/drive";
import { safeGetItem, safeSetItem } from "../utils/safeStorage";

// Default / stored OAuth configuration
const STORAGE_CLIENT_ID_KEY = "gdrive_client_id";
const STORAGE_ACCESS_TOKEN_KEY = "gdrive_access_token";
const STORAGE_TOKEN_EXPIRY_KEY = "gdrive_token_expiry";
const STORAGE_USER_KEY = "gdrive_current_user";

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// Declare google global namespace for GIS
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              expires_in?: number;
            }) => void;
            error_callback?: (error: unknown) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

export class GoogleAuthService {
  private tokenClient: ReturnType<
    NonNullable<
      NonNullable<Window["google"]>["accounts"]["oauth2"]["initTokenClient"]
    >
  > | null = null;
  private accessToken: string | null = null;
  private currentUser: DriveUser | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.accessToken = sessionStorage.getItem(STORAGE_ACCESS_TOKEN_KEY);
    const storedUser = sessionStorage.getItem(STORAGE_USER_KEY);
    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
      } catch {
        // ignore
      }
    }
  }

  public getClientId(): string {
    return (
      safeGetItem(STORAGE_CLIENT_ID_KEY) ||
      (import.meta as unknown as { env: { VITE_GOOGLE_CLIENT_ID?: string } })
        .env.VITE_GOOGLE_CLIENT_ID ||
      ""
    );
  }

  public setClientId(clientId: string): void {
    safeSetItem(STORAGE_CLIENT_ID_KEY, clientId.trim());
    this.tokenClient = null; // force re-init
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }

  public isAuthenticated(): boolean {
    if (!this.accessToken) return false;
    const expiry = sessionStorage.getItem(STORAGE_TOKEN_EXPIRY_KEY);
    if (expiry && Number(expiry) < Date.now()) {
      this.signOut();
      return false;
    }
    return true;
  }

  public getCurrentUser(): DriveUser | null {
    return this.currentUser;
  }

  public getAccessToken(): string | null {
    if (this.isAuthenticated()) {
      return this.accessToken;
    }
    return null;
  }

  public initTokenClient(): boolean {
    const clientId = this.getClientId();
    if (!clientId) return false;
    if (!window.google?.accounts?.oauth2) return false;

    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error("Google OAuth error:", tokenResponse.error);
            return;
          }

          if (tokenResponse.access_token) {
            this.accessToken = tokenResponse.access_token;
            sessionStorage.setItem(
              STORAGE_ACCESS_TOKEN_KEY,
              tokenResponse.access_token,
            );
            const expiryTime =
              Date.now() + (tokenResponse.expires_in || 3599) * 1000;
            sessionStorage.setItem(
              STORAGE_TOKEN_EXPIRY_KEY,
              expiryTime.toString(),
            );

            await this.fetchUserProfile();
            this.notify();
          }
        },
      });
      return true;
    } catch (err) {
      console.error("Failed to initialize Google token client:", err);
      return false;
    }
  }

  public async signIn(): Promise<boolean> {
    const clientId = this.getClientId();
    if (!clientId) {
      // If no client ID configured, simulate authentication for testing / mock mode
      this.accessToken = "mock_google_token_" + Date.now();
      sessionStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, this.accessToken);
      sessionStorage.setItem(
        STORAGE_TOKEN_EXPIRY_KEY,
        (Date.now() + 3600000).toString(),
      );
      this.currentUser = {
        displayName: "Demo User",
        emailAddress: "demo@example.invalid",
        me: true,
      };
      sessionStorage.setItem(
        STORAGE_USER_KEY,
        JSON.stringify(this.currentUser),
      );
      this.notify();
      return true;
    }

    if (!this.tokenClient) {
      const initialized = this.initTokenClient();
      if (!initialized) {
        throw new Error(
          "Google Identity Services script not yet loaded or client ID invalid.",
        );
      }
    }

    return new Promise((resolve) => {
      if (this.tokenClient) {
        this.tokenClient.requestAccessToken({ prompt: "select_account" });
        // The callback registered in initTokenClient will fire upon completion
        const unsubscribe = this.subscribe(() => {
          if (this.isAuthenticated()) {
            unsubscribe();
            resolve(true);
          }
        });
      } else {
        resolve(false);
      }
    });
  }

  private async fetchUserProfile(): Promise<void> {
    if (!this.accessToken) return;
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = {
          displayName: data.name || data.email,
          emailAddress: data.email,
          photoLink: data.picture,
          me: true,
        };
        sessionStorage.setItem(
          STORAGE_USER_KEY,
          JSON.stringify(this.currentUser),
        );
      }
    } catch (err) {
      console.warn("Could not fetch user profile:", err);
    }
  }

  public signOut(): void {
    this.accessToken = null;
    this.currentUser = null;
    sessionStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(STORAGE_USER_KEY);
    this.notify();
  }
}

export const authService = new GoogleAuthService();
