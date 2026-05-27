export function avatarUrl(seed: string, role: "ADMIN" | "TEACHER") {
  const style = role === "ADMIN" ? "notionists" : "avataaars";
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export function roleAvatarPresets(role: "ADMIN" | "TEACHER", name = "teacher") {
  const base =
    role === "ADMIN"
      ? ["principal", "school-admin", "mentor", "coordinator", "headmaster", "campus-lead", "admin-desk", "academic-lead", name]
      : ["teacher", "science-teacher", "class-guide", "math-teacher", "english-teacher", "physics-teacher", "lab-mentor", "faculty", name];
  return Array.from(new Set(base.map((seed) => avatarUrl(seed, role))));
}

export function fallbackAvatar(name: string | undefined, role: "ADMIN" | "TEACHER" = "TEACHER") {
  return avatarUrl(name || role.toLowerCase(), role);
}
