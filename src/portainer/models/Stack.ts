export interface Stack {
	AdditionalFiles: string[] | null;
	AutoUpdate: object | null;
	EndpointId: number;
	EntryPoint: string;
	Id: number;
	Option: object | null;
	Status: number;
	SwarmId: string;
	Type: number;
	CreationDate: number;
	FromAppTemplate: boolean;
	GitConfig: object | null;
	Name: string;
	Namespace: string;
	ProjectPath: string;
}
