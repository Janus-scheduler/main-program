export interface ResourceData {
  id: string;
  name: string;
  type?: "person" | "room" | "equipment";
  email?: string;
  avatar?: string;
}

export class Resource {
  id: string;
  name: string;
  type: "person" | "room" | "equipment";
  email: string;
  avatar: string;

  constructor(data: ResourceData) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type || "person";
    this.email = data.email || "";
    this.avatar = data.avatar || "";
  }

  // Check if resource data is valid
  isValid(): boolean {
    return !!(this.id && this.name);
  }
}
