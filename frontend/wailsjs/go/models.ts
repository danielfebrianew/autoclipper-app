export namespace clip {
	
	export class Clip {
	    id: string;
	    project_id: string;
	    clip_index: number;
	    start_seconds: number;
	    end_seconds: number;
	    duration_seconds: number;
	    speaker: string;
	    hook: string;
	    summary: string;
	    category: string;
	    energy_level: string;
	    viral_score: number;
	    content_score: number;
	    engagement_score: number;
	    thumbnail_text: string;
	    thumbnail_emotion: string;
	    thumbnail_timestamp: number;
	    suggested_caption: string;
	    transcript_excerpt: string;
	    enabled: boolean;
	    status: string;
	    raw_clip_path: string;
	    face_data_json: string;
	    subtitle_path: string;
	    final_clip_path: string;
	    aspect_ratio: string;
	    caption_style: string;
	    caption_position: string;
	    caption_size: string;
	    caption_text: string;
	    track_template: string;
	    track_smooth: boolean;
	    track_lock_main: boolean;
	    track_sensitivity: number;
	    track_reserve_bottom: boolean;
	    waveform_path: string;
	    favorite: boolean;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Clip(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.clip_index = source["clip_index"];
	        this.start_seconds = source["start_seconds"];
	        this.end_seconds = source["end_seconds"];
	        this.duration_seconds = source["duration_seconds"];
	        this.speaker = source["speaker"];
	        this.hook = source["hook"];
	        this.summary = source["summary"];
	        this.category = source["category"];
	        this.energy_level = source["energy_level"];
	        this.viral_score = source["viral_score"];
	        this.content_score = source["content_score"];
	        this.engagement_score = source["engagement_score"];
	        this.thumbnail_text = source["thumbnail_text"];
	        this.thumbnail_emotion = source["thumbnail_emotion"];
	        this.thumbnail_timestamp = source["thumbnail_timestamp"];
	        this.suggested_caption = source["suggested_caption"];
	        this.transcript_excerpt = source["transcript_excerpt"];
	        this.enabled = source["enabled"];
	        this.status = source["status"];
	        this.raw_clip_path = source["raw_clip_path"];
	        this.face_data_json = source["face_data_json"];
	        this.subtitle_path = source["subtitle_path"];
	        this.final_clip_path = source["final_clip_path"];
	        this.aspect_ratio = source["aspect_ratio"];
	        this.caption_style = source["caption_style"];
	        this.caption_position = source["caption_position"];
	        this.caption_size = source["caption_size"];
	        this.caption_text = source["caption_text"];
	        this.track_template = source["track_template"];
	        this.track_smooth = source["track_smooth"];
	        this.track_lock_main = source["track_lock_main"];
	        this.track_sensitivity = source["track_sensitivity"];
	        this.track_reserve_bottom = source["track_reserve_bottom"];
	        this.waveform_path = source["waveform_path"];
	        this.favorite = source["favorite"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GalleryItem {
	    id: string;
	    project_id: string;
	    clip_index: number;
	    start_seconds: number;
	    end_seconds: number;
	    duration_seconds: number;
	    speaker: string;
	    hook: string;
	    summary: string;
	    category: string;
	    energy_level: string;
	    viral_score: number;
	    content_score: number;
	    engagement_score: number;
	    thumbnail_text: string;
	    thumbnail_emotion: string;
	    thumbnail_timestamp: number;
	    suggested_caption: string;
	    transcript_excerpt: string;
	    enabled: boolean;
	    status: string;
	    raw_clip_path: string;
	    face_data_json: string;
	    subtitle_path: string;
	    final_clip_path: string;
	    aspect_ratio: string;
	    caption_style: string;
	    caption_position: string;
	    caption_size: string;
	    caption_text: string;
	    track_template: string;
	    track_smooth: boolean;
	    track_lock_main: boolean;
	    track_sensitivity: number;
	    track_reserve_bottom: boolean;
	    waveform_path: string;
	    favorite: boolean;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    source_title: string;
	    source_url: string;
	
	    static createFrom(source: any = {}) {
	        return new GalleryItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.clip_index = source["clip_index"];
	        this.start_seconds = source["start_seconds"];
	        this.end_seconds = source["end_seconds"];
	        this.duration_seconds = source["duration_seconds"];
	        this.speaker = source["speaker"];
	        this.hook = source["hook"];
	        this.summary = source["summary"];
	        this.category = source["category"];
	        this.energy_level = source["energy_level"];
	        this.viral_score = source["viral_score"];
	        this.content_score = source["content_score"];
	        this.engagement_score = source["engagement_score"];
	        this.thumbnail_text = source["thumbnail_text"];
	        this.thumbnail_emotion = source["thumbnail_emotion"];
	        this.thumbnail_timestamp = source["thumbnail_timestamp"];
	        this.suggested_caption = source["suggested_caption"];
	        this.transcript_excerpt = source["transcript_excerpt"];
	        this.enabled = source["enabled"];
	        this.status = source["status"];
	        this.raw_clip_path = source["raw_clip_path"];
	        this.face_data_json = source["face_data_json"];
	        this.subtitle_path = source["subtitle_path"];
	        this.final_clip_path = source["final_clip_path"];
	        this.aspect_ratio = source["aspect_ratio"];
	        this.caption_style = source["caption_style"];
	        this.caption_position = source["caption_position"];
	        this.caption_size = source["caption_size"];
	        this.caption_text = source["caption_text"];
	        this.track_template = source["track_template"];
	        this.track_smooth = source["track_smooth"];
	        this.track_lock_main = source["track_lock_main"];
	        this.track_sensitivity = source["track_sensitivity"];
	        this.track_reserve_bottom = source["track_reserve_bottom"];
	        this.waveform_path = source["waveform_path"];
	        this.favorite = source["favorite"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.source_title = source["source_title"];
	        this.source_url = source["source_url"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class CaptionOpts {
	    position: string;
	    size: string;
	
	    static createFrom(source: any = {}) {
	        return new CaptionOpts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.position = source["position"];
	        this.size = source["size"];
	    }
	}
	export class CommandResult {
	    intent: string;
	    project_id: string;
	    video_exists: boolean;
	    video_id: string;
	
	    static createFrom(source: any = {}) {
	        return new CommandResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.intent = source["intent"];
	        this.project_id = source["project_id"];
	        this.video_exists = source["video_exists"];
	        this.video_id = source["video_id"];
	    }
	}
	export class FaceFrame {
	    frame: number;
	    time: number;
	    x: number;
	    y: number;
	    w: number;
	    h: number;
	
	    static createFrom(source: any = {}) {
	        return new FaceFrame(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.frame = source["frame"];
	        this.time = source["time"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.w = source["w"];
	        this.h = source["h"];
	    }
	}
	export class CropPlan {
	    ratio: string;
	    keyframes: FaceFrame[];
	
	    static createFrom(source: any = {}) {
	        return new CropPlan(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ratio = source["ratio"];
	        this.keyframes = this.convertValues(source["keyframes"], FaceFrame);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DeletePreview {
	    clips: number;
	    videos: number;
	    source_bytes: number;
	    output_bytes: number;
	    meta_bytes: number;
	    total_bytes: number;
	    after_used_bytes: number;
	
	    static createFrom(source: any = {}) {
	        return new DeletePreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clips = source["clips"];
	        this.videos = source["videos"];
	        this.source_bytes = source["source_bytes"];
	        this.output_bytes = source["output_bytes"];
	        this.meta_bytes = source["meta_bytes"];
	        this.total_bytes = source["total_bytes"];
	        this.after_used_bytes = source["after_used_bytes"];
	    }
	}
	export class ExportOpts {
	    ratio: string;
	    burn: boolean;
	    codec: string;
	    out_dir: string;
	
	    static createFrom(source: any = {}) {
	        return new ExportOpts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ratio = source["ratio"];
	        this.burn = source["burn"];
	        this.codec = source["codec"];
	        this.out_dir = source["out_dir"];
	    }
	}
	
	export class FaceObs {
	    x: number;
	    y: number;
	    w: number;
	    h: number;
	    conf: number;
	
	    static createFrom(source: any = {}) {
	        return new FaceObs(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	        this.w = source["w"];
	        this.h = source["h"];
	        this.conf = source["conf"];
	    }
	}
	export class FaceSampleEntry {
	    time: number;
	    faces: FaceObs[];
	
	    static createFrom(source: any = {}) {
	        return new FaceSampleEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.time = source["time"];
	        this.faces = this.convertValues(source["faces"], FaceObs);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LibraryVideo {
	    video_id: string;
	    title: string;
	    youtube_url: string;
	    duration: number;
	    source_bytes: number;
	    video_path: string;
	    file_exists: boolean;
	    status: string;
	    thumb_path: string;
	    clip_count: number;
	    project_count: number;
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new LibraryVideo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.video_id = source["video_id"];
	        this.title = source["title"];
	        this.youtube_url = source["youtube_url"];
	        this.duration = source["duration"];
	        this.source_bytes = source["source_bytes"];
	        this.video_path = source["video_path"];
	        this.file_exists = source["file_exists"];
	        this.status = source["status"];
	        this.thumb_path = source["thumb_path"];
	        this.clip_count = source["clip_count"];
	        this.project_count = source["project_count"];
	        this.created_at = source["created_at"];
	    }
	}
	export class LicenseStatus {
	    valid: boolean;
	    serial: string;
	
	    static createFrom(source: any = {}) {
	        return new LicenseStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.serial = source["serial"];
	    }
	}
	export class Provider {
	    id: string;
	    name: string;
	    primary: boolean;
	    use: string;
	    site: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new Provider(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.primary = source["primary"];
	        this.use = source["use"];
	        this.site = source["site"];
	        this.status = source["status"];
	    }
	}
	export class ProviderStatus {
	    connected: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ProviderStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.message = source["message"];
	    }
	}
	export class StartDownloadResult {
	    project_id: string;
	    video_exists: boolean;
	    video_id: string;
	    video_title: string;
	
	    static createFrom(source: any = {}) {
	        return new StartDownloadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project_id = source["project_id"];
	        this.video_exists = source["video_exists"];
	        this.video_id = source["video_id"];
	        this.video_title = source["video_title"];
	    }
	}
	export class VideoUsage {
	    project_id: string;
	    title: string;
	    channel: string;
	    clips: number;
	    source_bytes: number;
	    output_bytes: number;
	    meta_bytes: number;
	
	    static createFrom(source: any = {}) {
	        return new VideoUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project_id = source["project_id"];
	        this.title = source["title"];
	        this.channel = source["channel"];
	        this.clips = source["clips"];
	        this.source_bytes = source["source_bytes"];
	        this.output_bytes = source["output_bytes"];
	        this.meta_bytes = source["meta_bytes"];
	    }
	}
	export class StorageCat {
	    key: string;
	    label: string;
	    color: string;
	    size_bytes: number;
	
	    static createFrom(source: any = {}) {
	        return new StorageCat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.color = source["color"];
	        this.size_bytes = source["size_bytes"];
	    }
	}
	export class Storage {
	    limit_gb: number;
	    categories: StorageCat[];
	    per_video: VideoUsage[];
	
	    static createFrom(source: any = {}) {
	        return new Storage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.limit_gb = source["limit_gb"];
	        this.categories = this.convertValues(source["categories"], StorageCat);
	        this.per_video = this.convertValues(source["per_video"], VideoUsage);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ThreadStep {
	    role: string;
	    kind: string;
	    text: string;
	    meta: Record<string, any>;
	    time: string;
	
	    static createFrom(source: any = {}) {
	        return new ThreadStep(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.kind = source["kind"];
	        this.text = source["text"];
	        this.meta = source["meta"];
	        this.time = source["time"];
	    }
	}
	export class TrackOpts {
	    smooth: boolean;
	    lock_main: boolean;
	    sensitivity: number;
	    reserve_bottom: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TrackOpts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.smooth = source["smooth"];
	        this.lock_main = source["lock_main"];
	        this.sensitivity = source["sensitivity"];
	        this.reserve_bottom = source["reserve_bottom"];
	    }
	}
	export class TranscriptSegment {
	    text: string;
	    start: number;
	    end: number;
	
	    static createFrom(source: any = {}) {
	        return new TranscriptSegment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.start = source["start"];
	        this.end = source["end"];
	    }
	}
	export class UpdateInfo {
	    current: string;
	    latest: string;
	    available: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.current = source["current"];
	        this.latest = source["latest"];
	        this.available = source["available"];
	    }
	}

}

export namespace overlay {
	
	export class Click {
	    enabled: boolean;
	    volume: number;
	
	    static createFrom(source: any = {}) {
	        return new Click(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.volume = source["volume"];
	    }
	}
	export class Cover {
	    path: string;
	    duration_sec: number;
	
	    static createFrom(source: any = {}) {
	        return new Cover(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.duration_sec = source["duration_sec"];
	    }
	}
	export class Image {
	    id: string;
	    path: string;
	    name: string;
	    width: number;
	    height: number;
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Image(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.name = source["name"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Layout {
	    image_area_ratio: number;
	    image_fit: string;
	    background_color: string;
	    aspect_ratio: string;
	
	    static createFrom(source: any = {}) {
	        return new Layout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.image_area_ratio = source["image_area_ratio"];
	        this.image_fit = source["image_fit"];
	        this.background_color = source["background_color"];
	        this.aspect_ratio = source["aspect_ratio"];
	    }
	}
	export class Track {
	    id: string;
	    kind: string;
	    asset_path: string;
	    asset_name: string;
	    start_sec: number;
	    end_sec: number;
	    trim_start_sec: number;
	    fit_override: string;
	    click_enabled?: boolean;
	    sort_order: number;
	
	    static createFrom(source: any = {}) {
	        return new Track(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.asset_path = source["asset_path"];
	        this.asset_name = source["asset_name"];
	        this.start_sec = source["start_sec"];
	        this.end_sec = source["end_sec"];
	        this.trim_start_sec = source["trim_start_sec"];
	        this.fit_override = source["fit_override"];
	        this.click_enabled = source["click_enabled"];
	        this.sort_order = source["sort_order"];
	    }
	}
	export class Project {
	    id: string;
	    name: string;
	    source_video_path: string;
	    source_clip_id: string;
	    video_width: number;
	    video_height: number;
	    video_fps: number;
	    video_duration: number;
	    layout: Layout;
	    click_sound: Click;
	    cover?: Cover;
	    tracks: Track[];
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.source_video_path = source["source_video_path"];
	        this.source_clip_id = source["source_clip_id"];
	        this.video_width = source["video_width"];
	        this.video_height = source["video_height"];
	        this.video_fps = source["video_fps"];
	        this.video_duration = source["video_duration"];
	        this.layout = this.convertValues(source["layout"], Layout);
	        this.click_sound = this.convertValues(source["click_sound"], Click);
	        this.cover = this.convertValues(source["cover"], Cover);
	        this.tracks = this.convertValues(source["tracks"], Track);
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace project {
	
	export class Project {
	    id: string;
	    source_video_id: string;
	    name: string;
	    status: string;
	    gemini_json: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.source_video_id = source["source_video_id"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.gemini_json = source["gemini_json"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace settings {
	
	export class Settings {
	    gemini_api_key: string;
	    kie_api_key: string;
	    openai_api_key: string;
	    gemini_model: string;
	    transcript_language: string;
	    transcript_engine: string;
	    subtitle_style: string;
	    max_clips: number;
	    min_duration: number;
	    max_duration: number;
	    output_dir: string;
	    license_serial: string;
	    default_ratio: string;
	    default_clip_duration: number;
	    auto_reframe: boolean;
	    delete_source_after: boolean;
	    open_on_startup: boolean;
	    ui_language: string;
	    storage_limit_gb: number;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.gemini_api_key = source["gemini_api_key"];
	        this.kie_api_key = source["kie_api_key"];
	        this.openai_api_key = source["openai_api_key"];
	        this.gemini_model = source["gemini_model"];
	        this.transcript_language = source["transcript_language"];
	        this.transcript_engine = source["transcript_engine"];
	        this.subtitle_style = source["subtitle_style"];
	        this.max_clips = source["max_clips"];
	        this.min_duration = source["min_duration"];
	        this.max_duration = source["max_duration"];
	        this.output_dir = source["output_dir"];
	        this.license_serial = source["license_serial"];
	        this.default_ratio = source["default_ratio"];
	        this.default_clip_duration = source["default_clip_duration"];
	        this.auto_reframe = source["auto_reframe"];
	        this.delete_source_after = source["delete_source_after"];
	        this.open_on_startup = source["open_on_startup"];
	        this.ui_language = source["ui_language"];
	        this.storage_limit_gb = source["storage_limit_gb"];
	    }
	}

}

export namespace setup {
	
	export class Dependency {
	    name: string;
	    status: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Dependency(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.status = source["status"];
	        this.message = source["message"];
	    }
	}

}

export namespace video {
	
	export class Video {
	    id: string;
	    youtube_url: string;
	    video_id: string;
	    title: string;
	    channel: string;
	    duration: number;
	    views: number;
	    video_path: string;
	    source_bytes: number;
	    heatmap_json: string;
	    transcript_json: string;
	    is_local: boolean;
	    status: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Video(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.youtube_url = source["youtube_url"];
	        this.video_id = source["video_id"];
	        this.title = source["title"];
	        this.channel = source["channel"];
	        this.duration = source["duration"];
	        this.views = source["views"];
	        this.video_path = source["video_path"];
	        this.source_bytes = source["source_bytes"];
	        this.heatmap_json = source["heatmap_json"];
	        this.transcript_json = source["transcript_json"];
	        this.is_local = source["is_local"];
	        this.status = source["status"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

