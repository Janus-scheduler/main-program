export interface ResourceData {
  id: string;
  name: string;
  type?: 'person' | 'room' | 'equipment';
  email?: string;
}

export class Resource {
  id: string;
  name: string;
  type: 'person' | 'room' | 'equipment';
  email: string;

  constructor(data: ResourceData) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type || 'person';
    this.email = data.email || '';
  }

  // Check if resource data is valid
  isValid(): boolean {
    return !!(this.id && this.name);
  }
}