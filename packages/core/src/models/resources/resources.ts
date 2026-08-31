export interface ResourceData {
  id: string;
  name: string;
  type?: "person" | "room" | "equipment" | (string & {});
  email?: string;
  avatar?: string;
  subtitle?: string;
}

export class Resource {
  id: string;
  name: string;
  type: "person" | "room" | "equipment" | (string & {});
  email: string;
  avatar: string;
  subtitle: string;

  constructor(data: ResourceData) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type || "person";
    this.email = data.email || "";
    this.avatar = data.avatar || "";
    this.subtitle = data.subtitle || "";
  }

  // Check if resource data is valid
  isValid(): boolean {
    return !!(this.id && this.name);
  }
}
