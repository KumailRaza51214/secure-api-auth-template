import { Platform } from "react-native";

export type Todo = {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
  username?: string | null;
  user_id?: number | null;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  username: string;
};

// Set EXPO_PUBLIC_API_URL to your computer's LAN address when using a physical device.
// Example: EXPO_PUBLIC_API_URL=http://192.168.1.25:8000
const defaultApiUrl = Platform.select({
  android: "http://10.0.2.2:8000",
  ios: "http://localhost:8000",
  default: "http://localhost:8000",
});

type ExpoEnvironment = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const expoEnvironment = globalThis as typeof globalThis & ExpoEnvironment;
export const API_URL = (expoEnvironment.process?.env?.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status}).`);
  }
  return body as T;
}

export const login = (username: string) =>
  request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ username }) });

export const getTodos = (token: string) => request<Todo[]>("/todos", {}, token);

export const createTodo = (token: string, title: string, description: string) =>
  request<{ todo: Todo }>("/todos", {
    method: "POST",
    body: JSON.stringify({ title, description: description || null }),
  }, token);

export const updateTodo = (token: string, id: number, changes: Partial<Pick<Todo, "title" | "description" | "completed">>) =>
  request<{ todo: Todo }>(`/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  }, token);

export const deleteTodo = (token: string, id: number) => request<{ message: string }>(`/todos/${id}`, { method: "DELETE" }, token);

export const getDatabaseTodos = (token: string) => request<Todo[]>("/api/db/todos", {}, token);

export const deleteDatabaseTodo = (token: string, id: number) =>
  request<{ message: string }>(`/api/db/todos/${id}`, { method: "DELETE" }, token);
