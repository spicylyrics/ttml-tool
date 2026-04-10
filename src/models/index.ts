export interface Model {
  id: string;
  name: string;
  version: string;
  predict(input: any): Promise<any>;
}

export type ModelFactory = () => Model;

// Simple in-memory registry for available models
type RegistryMap = Map<string, Model>;
export const modelsRegistry: RegistryMap = new Map();

export function registerModel(model: Model): void {
  modelsRegistry.set(model.id, model);
}

export function getModel(id: string): Model | undefined {
  return modelsRegistry.get(id);
}

export function listModels(): Model[] {
  return Array.from(modelsRegistry.values());
}
