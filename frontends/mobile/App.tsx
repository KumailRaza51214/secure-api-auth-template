import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { API_URL, createTodo, deleteDatabaseTodo, deleteTodo, getDatabaseTodos, getTodos, login, Todo, updateTodo } from "./src/api";

const TOKEN_KEY = "taskflow_token";
const USERNAME_KEY = "taskflow_username";
const ADMIN_USERS = new Set(["Kumail", "Abbas"]);

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [adminTodos, setAdminTodos] = useState<Todo[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  const loadTodos = useCallback(async (activeToken: string) => {
    const items = await getTodos(activeToken);
    setTodos(items);
  }, []);

  useEffect(() => {
    (async () => {
      const [savedToken, savedUsername] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USERNAME_KEY),
      ]);
      if (savedToken && savedUsername) {
        try {
          await loadTodos(savedToken);
          setToken(savedToken);
          setUsername(savedUsername);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USERNAME_KEY);
        }
      }
      setLoading(false);
    })();
  }, [loadTodos]);

  useEffect(() => {
    if (!token) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    const connect = () => {
      const socketUrl = `${API_URL.replace(/^http/, "ws")}/ws/todos?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        if (!mounted) return;
        setSocketReady(true);
      };

      socket.onmessage = (message) => {
        if (!mounted) return;
        try {
          const event = JSON.parse(message.data) as { type: string; todo?: Todo; todo_id?: number };
          setTodos((current) => {
            if (event.type === "deleted") return current.filter((todo) => todo.id !== event.todo_id);
            if (!event.todo) return current;
            const index = current.findIndex((todo) => todo.id === event.todo?.id);
            if (index === -1) return [event.todo, ...current];
            return current.map((todo) => todo.id === event.todo?.id ? event.todo! : todo);
          });
        } catch {
          // Ignore malformed real-time events and preserve the current list.
        }
      };

      socket.onclose = () => {
        if (!mounted) return;
        setSocketReady(false);
        if (token) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        if (!mounted) return;
        socket?.close();
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token]);

  const signIn = async () => {
    const name = usernameInput.trim();
    if (!name) return Alert.alert("Name required", "Enter your name to continue.");
    setSubmitting(true);
    try {
      const result = await login(name);
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, result.access_token),
        SecureStore.setItemAsync(USERNAME_KEY, result.username),
      ]);
      await loadTodos(result.access_token);
      setToken(result.access_token);
      setUsername(result.username);
    } catch (error) {
      Alert.alert("Could not sign in", error instanceof Error ? error.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const addTodo = async () => {
    if (!token) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return Alert.alert("Task required", "Enter a task title.");
    setSubmitting(true);
    try {
      await createTodo(token, trimmedTitle, description.trim());
      setTitle("");
      setDescription("");
      if (!socketReady) {
        await loadTodos(token);
      }
    } catch (error) {
      Alert.alert("Could not add task", error instanceof Error ? error.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    if (!token) return;
    try {
      await updateTodo(token, todo.id, { completed: !todo.completed });
      if (!socketReady) {
        await loadTodos(token);
      }
    } catch (error) {
      Alert.alert("Could not update task", error instanceof Error ? error.message : "Try again.");
    }
  };

  const removeTodo = (todo: Todo) => {
    Alert.alert("Delete task?", `Remove "${todo.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          if (!token) return;
          try {
            await deleteTodo(token, todo.id);
            if (!socketReady) {
              await loadTodos(token);
            }
          } catch (error) {
            Alert.alert("Could not delete task", error instanceof Error ? error.message : "Try again.");
          }
        },
      },
    ]);
  };

  const signOut = async () => {
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USERNAME_KEY)]);
    setToken(null); setUsername(""); setTodos([]); setAdminTodos([]); setShowAdmin(false); setUsernameInput("");
  };

  const loadAdminTodos = async () => {
    if (!token) return;
    setAdminLoading(true);
    try {
      setAdminTodos(await getDatabaseTodos(token));
    } catch (error) {
      Alert.alert("Admin access denied", error instanceof Error ? error.message : "You do not have database access.");
      setShowAdmin(false);
    } finally {
      setAdminLoading(false);
    }
  };

  const openAdmin = async () => {
    if (!ADMIN_USERS.has(username)) return;
    setShowAdmin(true);
    await loadAdminTodos();
  };

  const removeDatabaseTodo = (todo: Todo) => {
    Alert.alert("Delete any user's task?", `Remove “${todo.title}” created by ${todo.username || "an unknown user"}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!token) return;
        try {
          await deleteDatabaseTodo(token, todo.id);
          setAdminTodos((current) => current.filter((item) => item.id !== todo.id));
        } catch (error) {
          Alert.alert("Could not delete task", error instanceof Error ? error.message : "Try again.");
        }
      } },
    ]);
  };

  const stats = useMemo(() => ({ done: todos.filter((todo) => todo.completed).length, total: todos.length }), [todos]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#4f46e5" /></SafeAreaView>;

  if (!token) return <SafeAreaView style={styles.center}><StatusBar barStyle="dark-content" />
    <View style={styles.loginCard}>
      <Text style={styles.logo}>✓</Text><Text style={styles.heading}>Welcome to TaskFlow</Text>
      <Text style={styles.subheading}>Enter your name to manage your tasks.</Text>
      <TextInput value={usernameInput} onChangeText={setUsernameInput} placeholder="Enter your name" autoCapitalize="words" style={styles.input} onSubmitEditing={signIn} />
      <Pressable style={styles.primaryButton} onPress={signIn} disabled={submitting}><Text style={styles.primaryButtonText}>{submitting ? "Signing in…" : "Sign in"}</Text></Pressable>
      <Text style={styles.apiHint}>API: {API_URL}</Text>
    </View>
  </SafeAreaView>;

  if (showAdmin) {
    const completed = adminTodos.filter((todo) => todo.completed).length;
    const users = new Set(adminTodos.map((todo) => todo.username)).size;
    return <SafeAreaView style={styles.screen}><StatusBar barStyle="light-content" />
      <View style={styles.adminHeader}><View><Text style={styles.adminTitle}>Database Viewer</Text><Text style={styles.adminSubtitle}>Admin: {username}</Text></View><Pressable onPress={() => setShowAdmin(false)}><Text style={styles.adminBack}>Back to tasks</Text></Pressable></View>
      <View style={styles.adminStats}><Text style={styles.adminStat}>{adminTodos.length} total</Text><Text style={styles.adminStat}>{completed} done</Text><Text style={styles.adminStat}>{adminTodos.length - completed} pending</Text><Text style={styles.adminStat}>{users} users</Text></View>
      <Pressable style={styles.refreshButton} onPress={loadAdminTodos} disabled={adminLoading}><Text style={styles.refreshText}>{adminLoading ? "Refreshing…" : "Refresh database"}</Text></Pressable>
      <FlatList data={adminTodos} keyExtractor={(item) => String(item.id)} contentContainerStyle={adminTodos.length ? styles.list : styles.emptyList} ListEmptyComponent={<Text style={styles.empty}>{adminLoading ? "Loading database…" : "No todos found."}</Text>} renderItem={({ item }) => <View style={styles.adminTodo}><View style={styles.todoText}><Text style={styles.adminTodoTitle}>#{item.id} · {item.title}</Text>{item.description ? <Text style={styles.todoDescription}>{item.description}</Text> : null}<Text style={styles.adminMeta}>{item.username || "Unknown user"} · {item.completed ? "Done" : "Pending"}</Text></View><Pressable onPress={() => removeDatabaseTodo(item)}><Text style={styles.delete}>Delete</Text></Pressable></View>} />
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.screen}><StatusBar barStyle="dark-content" />
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}><View><Text style={styles.appName}>TaskFlow</Text><Text style={styles.greeting}>Hello, {username}</Text></View><View style={styles.headerActions}>{ADMIN_USERS.has(username) ? <Pressable onPress={openAdmin}><Text style={styles.adminLink}>Database</Text></Pressable> : null}<Pressable onPress={signOut}><Text style={styles.signOut}>Sign out</Text></Pressable></View></View>
      <View style={styles.composer}><TextInput value={title} onChangeText={setTitle} placeholder="What needs to be done?" style={styles.input} maxLength={100} /><TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" style={styles.input} maxLength={500} /><Pressable style={styles.primaryButton} onPress={addTodo} disabled={submitting}><Text style={styles.primaryButtonText}>{submitting ? "Adding…" : "Add task"}</Text></Pressable></View>
      <Text style={styles.stats}>{stats.total} total · {stats.total - stats.done} pending · {stats.done} done</Text>
      <FlatList data={[...todos].sort((a, b) => Number(a.completed) - Number(b.completed))} keyExtractor={(item) => String(item.id)} contentContainerStyle={todos.length ? styles.list : styles.emptyList} ListEmptyComponent={<Text style={styles.empty}>No tasks yet — add your first one above!</Text>} renderItem={({ item }) => <View style={[styles.todo, item.completed && styles.todoCompleted]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.completed }} onPress={() => toggleTodo(item)} style={[styles.checkbox, item.completed && styles.checkboxChecked]}><Text style={styles.checkmark}>{item.completed ? "✓" : ""}</Text></Pressable><View style={styles.todoText}><Text style={[styles.todoTitle, item.completed && styles.strike]}>{item.title}</Text>{item.description ? <Text style={styles.todoDescription}>{item.description}</Text> : null}</View><Pressable onPress={() => removeTodo(item)}><Text style={styles.delete}>Delete</Text></Pressable></View>} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" }, center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f1f5f9" }, loginCard: { backgroundColor: "white", borderRadius: 20, padding: 28, shadowColor: "#4f46e5", shadowOpacity: 0.15, shadowRadius: 24, elevation: 4 }, logo: { alignSelf: "center", color: "white", backgroundColor: "#4f46e5", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10, fontSize: 30, fontWeight: "800" }, heading: { textAlign: "center", fontSize: 26, fontWeight: "800", color: "#1e293b", marginTop: 22 }, subheading: { textAlign: "center", color: "#64748b", marginTop: 8, marginBottom: 24 }, input: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 16, color: "#1e293b", marginBottom: 10 }, primaryButton: { backgroundColor: "#4f46e5", padding: 15, borderRadius: 12, alignItems: "center" }, primaryButtonText: { color: "white", fontWeight: "700", fontSize: 16 }, apiHint: { color: "#94a3b8", fontSize: 11, textAlign: "center", marginTop: 16 }, header: { padding: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 16 }, appName: { fontSize: 22, fontWeight: "800", color: "#1e293b" }, greeting: { color: "#64748b", marginTop: 2 }, signOut: { color: "#4f46e5", fontWeight: "700" }, adminLink: { color: "#b45309", fontWeight: "800" }, composer: { margin: 16, padding: 16, backgroundColor: "white", borderRadius: 16 }, stats: { marginHorizontal: 20, color: "#64748b", fontWeight: "600" }, list: { padding: 16, paddingTop: 12 }, emptyList: { flexGrow: 1, justifyContent: "center", alignItems: "center" }, empty: { color: "#64748b", textAlign: "center", padding: 24 }, todo: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 14, backgroundColor: "white", marginBottom: 10 }, todoCompleted: { opacity: 0.65 }, checkbox: { height: 26, width: 26, borderRadius: 8, borderWidth: 2, borderColor: "#94a3b8", justifyContent: "center", alignItems: "center" }, checkboxChecked: { backgroundColor: "#10b981", borderColor: "#10b981" }, checkmark: { color: "white", fontWeight: "800" }, todoText: { flex: 1 }, todoTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" }, todoDescription: { color: "#64748b", marginTop: 3 }, strike: { textDecorationLine: "line-through" }, delete: { color: "#ef4444", fontWeight: "600" }, adminHeader: { padding: 22, backgroundColor: "#0f172a", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, adminTitle: { color: "white", fontSize: 22, fontWeight: "800" }, adminSubtitle: { color: "#cbd5e1", marginTop: 3 }, adminBack: { color: "#fbbf24", fontWeight: "700" }, adminStats: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16, backgroundColor: "#1e293b" }, adminStat: { backgroundColor: "#334155", color: "#f8fafc", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: "700" }, refreshButton: { margin: 16, backgroundColor: "#2563eb", borderRadius: 10, padding: 12, alignItems: "center" }, refreshText: { color: "white", fontWeight: "700" }, adminTodo: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 14, backgroundColor: "white", marginBottom: 10 }, adminTodoTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" }, adminMeta: { color: "#64748b", marginTop: 6, fontSize: 12 },
});
