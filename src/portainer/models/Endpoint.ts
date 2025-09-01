import { EndpointType } from '../enum/EndpointType';

export interface Endpoint {
	Id: number;
	Name: string;
	Type: EndpointType;
	URL: string;
}
