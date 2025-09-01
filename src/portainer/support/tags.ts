import { SAILOR_IMAGE_TAG_FORMAT } from '../../constants';

export function isSailorImageTag(image: string) {
	return SAILOR_IMAGE_TAG_FORMAT.test(image);
}
