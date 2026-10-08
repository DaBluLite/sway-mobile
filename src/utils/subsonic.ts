import { SubsonicService } from "../services/subsonic-service";
import { ISubsonicService } from "../types/subsonic";

const subsonicService: ISubsonicService = new SubsonicService();

export default subsonicService as ISubsonicService;