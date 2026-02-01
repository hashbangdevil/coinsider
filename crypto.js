// ========================================
// Coinsider - Client-Side Encryption Module
// ========================================
// Uses Web Crypto API for AES-256-GCM encryption
// ========================================

// Simple wordlist for recovery phrases (256 common words)
const RECOVERY_WORDS = [
    'apple', 'banana', 'orange', 'grape', 'lemon', 'melon', 'peach', 'plum',
    'cherry', 'berry', 'mango', 'kiwi', 'olive', 'onion', 'carrot', 'potato',
    'tomato', 'pepper', 'garlic', 'ginger', 'basil', 'thyme', 'mint', 'sage',
    'ocean', 'river', 'lake', 'stream', 'creek', 'pond', 'beach', 'coast',
    'mountain', 'valley', 'forest', 'meadow', 'desert', 'island', 'cliff', 'cave',
    'sunset', 'sunrise', 'rainbow', 'thunder', 'lightning', 'breeze', 'storm', 'cloud',
    'tiger', 'lion', 'bear', 'wolf', 'eagle', 'hawk', 'falcon', 'owl',
    'dolphin', 'whale', 'shark', 'salmon', 'turtle', 'rabbit', 'deer', 'fox',
    'silver', 'golden', 'bronze', 'copper', 'iron', 'steel', 'crystal', 'diamond',
    'ruby', 'emerald', 'sapphire', 'pearl', 'amber', 'jade', 'coral', 'marble',
    'piano', 'guitar', 'violin', 'trumpet', 'flute', 'drum', 'harp', 'cello',
    'castle', 'tower', 'bridge', 'garden', 'palace', 'temple', 'chapel', 'cottage',
    'captain', 'pilot', 'sailor', 'knight', 'prince', 'queen', 'king', 'duke',
    'artist', 'writer', 'dancer', 'singer', 'actor', 'chef', 'baker', 'farmer',
    'gentle', 'brave', 'swift', 'calm', 'bright', 'bold', 'clever', 'humble',
    'ancient', 'modern', 'classic', 'royal', 'cosmic', 'mystic', 'noble', 'grand',
    'spring', 'summer', 'autumn', 'winter', 'morning', 'evening', 'midnight', 'dawn',
    'north', 'south', 'east', 'west', 'center', 'corner', 'border', 'edge',
    'circle', 'square', 'triangle', 'spiral', 'arrow', 'star', 'heart', 'crown',
    'window', 'mirror', 'candle', 'lantern', 'beacon', 'torch', 'flame', 'spark',
    'velvet', 'silk', 'cotton', 'linen', 'wool', 'leather', 'satin', 'denim',
    'coffee', 'cocoa', 'honey', 'sugar', 'vanilla', 'cinnamon', 'nutmeg', 'clove',
    'journey', 'voyage', 'quest', 'mission', 'venture', 'search', 'pursuit', 'trail',
    'wisdom', 'courage', 'honor', 'glory', 'grace', 'peace', 'hope', 'dream',
    'canvas', 'sketch', 'portrait', 'mosaic', 'sculpture', 'gallery', 'studio', 'frame',
    'anchor', 'compass', 'harbor', 'vessel', 'cargo', 'fleet', 'voyage', 'horizon',
    'cricket', 'falcon', 'panther', 'phoenix', 'dragon', 'griffin', 'sphinx', 'unicorn',
    'willow', 'maple', 'cedar', 'birch', 'oak', 'pine', 'palm', 'bamboo',
    'violet', 'indigo', 'scarlet', 'crimson', 'azure', 'ivory', 'ebony', 'amber',
    'puzzle', 'riddle', 'secret', 'mystery', 'legend', 'story', 'fable', 'myth',
    'thunder', 'whisper', 'echo', 'harmony', 'melody', 'rhythm', 'tempo', 'chorus',
    'summit', 'zenith', 'apex', 'peak', 'crest', 'ridge', 'slope', 'plateau'
];

const CryptoModule = {
    // Configuration
    PBKDF2_ITERATIONS: 600000,

    // State
    mek: null,
    isUnlocked: false,

    // Session storage key (survives soft refreshes within same tab)
    SESSION_KEY: 'budget_manager_session_key',

    // Initialize - call after page load
    init() {
        this.mek = null;
        this.isUnlocked = false;
    },

    // Check if encryption is unlocked
    isReady() {
        return this.isUnlocked && this.mek !== null;
    },

    // Clear keys from memory
    lock() {
        this.mek = null;
        this.isUnlocked = false;
    },

    // Convert ArrayBuffer to Base64 string
    bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    // Convert Base64 string to ArrayBuffer
    base64ToBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    },

    // Generate random bytes
    getRandomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    },

    // Derive a key from password using PBKDF2
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['wrapKey', 'unwrapKey']
        );
    },

    // Encrypt data using AES-GCM with the MEK
    async encryptData(plaintext) {
        if (!this.mek) {
            throw new Error('Encryption not unlocked');
        }

        const encoder = new TextEncoder();
        const iv = this.getRandomBytes(12);

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.mek,
            encoder.encode(plaintext)
        );

        // Combine IV + ciphertext
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);

        return 'ENC:v1:' + this.bufferToBase64(combined.buffer);
    },

    // Decrypt data using AES-GCM with the MEK
    async decryptData(encryptedString) {
        if (!this.mek) {
            throw new Error('Encryption not unlocked');
        }

        // Check for encryption prefix
        if (!encryptedString.startsWith('ENC:v1:')) {
            return encryptedString; // Return as-is if not encrypted
        }

        const base64Data = encryptedString.slice(7); // Remove 'ENC:v1:' prefix
        const combined = new Uint8Array(this.base64ToBuffer(base64Data));

        // Extract IV (first 12 bytes) and ciphertext
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            this.mek,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    },

    // Generate a new Master Encryption Key (MEK)
    async generateMEK() {
        return crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    // Wrap (encrypt) the MEK with a KEK derived from password
    async wrapMEK(mek, kek) {
        const iv = this.getRandomBytes(12);

        const wrappedKey = await crypto.subtle.wrapKey(
            'raw',
            mek,
            kek,
            { name: 'AES-GCM', iv: iv }
        );

        // Combine IV + wrapped key
        const combined = new Uint8Array(iv.length + wrappedKey.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(wrappedKey), iv.length);

        return this.bufferToBase64(combined.buffer);
    },

    // Unwrap (decrypt) the MEK with a KEK derived from password
    async unwrapMEK(wrappedMEKBase64, kek) {
        const combined = new Uint8Array(this.base64ToBuffer(wrappedMEKBase64));

        // Extract IV and wrapped key
        const iv = combined.slice(0, 12);
        const wrappedKey = combined.slice(12);

        return crypto.subtle.unwrapKey(
            'raw',
            wrappedKey,
            kek,
            { name: 'AES-GCM', iv: iv },
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    // Enable encryption for a user - returns data to send to server
    async enableEncryption(password) {
        // Generate new MEK
        const mek = await this.generateMEK();

        // Generate salt for password-based KEK
        const salt = this.getRandomBytes(16);

        // Derive KEK from password
        const kek = await this.deriveKey(password, salt);

        // Wrap MEK with KEK
        const wrappedMEK = await this.wrapMEK(mek, kek);

        // Generate recovery key (24 random words)
        const recoveryData = this.generateRecoveryKey();

        // Generate salt for recovery-based KEK
        const recoverySalt = this.getRandomBytes(16);

        // Derive recovery KEK
        const recoveryKEK = await this.deriveKey(recoveryData.phrase, recoverySalt);

        // Wrap MEK with recovery KEK
        const recoveryWrappedMEK = await this.wrapMEK(mek, recoveryKEK);

        // Store MEK in memory
        this.mek = mek;
        this.isUnlocked = true;

        return {
            salt: this.bufferToBase64(salt.buffer),
            wrappedMEK: wrappedMEK,
            recoverySalt: this.bufferToBase64(recoverySalt.buffer),
            recoveryWrappedMEK: recoveryWrappedMEK,
            recoveryPhrase: recoveryData.phrase
        };
    },

    // Unlock encryption with password
    async unlock(password, salt, wrappedMEK) {
        const saltBuffer = new Uint8Array(this.base64ToBuffer(salt));

        // Derive KEK from password
        const kek = await this.deriveKey(password, saltBuffer);

        // Unwrap MEK
        const mek = await this.unwrapMEK(wrappedMEK, kek);

        // Store in memory
        this.mek = mek;
        this.isUnlocked = true;

        return true;
    },

    // Unlock encryption with recovery phrase
    async unlockWithRecovery(recoveryPhrase, recoverySalt, recoveryWrappedMEK) {
        const saltBuffer = new Uint8Array(this.base64ToBuffer(recoverySalt));

        // Derive recovery KEK
        const recoveryKEK = await this.deriveKey(recoveryPhrase, saltBuffer);

        // Unwrap MEK
        const mek = await this.unwrapMEK(recoveryWrappedMEK, recoveryKEK);

        // Store in memory
        this.mek = mek;
        this.isUnlocked = true;

        return true;
    },

    // Change encryption password (re-wrap MEK with new password)
    async changePassword(newPassword) {
        if (!this.mek) {
            throw new Error('Encryption not unlocked');
        }

        // Generate new salt
        const salt = this.getRandomBytes(16);

        // Derive new KEK
        const kek = await this.deriveKey(newPassword, salt);

        // Wrap MEK with new KEK
        const wrappedMEK = await this.wrapMEK(this.mek, kek);

        return {
            salt: this.bufferToBase64(salt.buffer),
            wrappedMEK: wrappedMEK
        };
    },

    // Generate a recovery phrase (12 random words)
    generateRecoveryKey() {
        const wordCount = 12;
        const words = [];
        const randomBytes = this.getRandomBytes(wordCount);

        for (let i = 0; i < wordCount; i++) {
            const index = randomBytes[i] % RECOVERY_WORDS.length;
            words.push(RECOVERY_WORDS[index]);
        }

        return {
            words: words,
            phrase: words.join(' ')
        };
    },

    // Validate a recovery phrase
    validateRecoveryPhrase(phrase) {
        const words = phrase.trim().toLowerCase().split(/\s+/);
        if (words.length !== 12) {
            return { valid: false, error: 'Recovery phrase must be 12 words' };
        }

        for (const word of words) {
            if (!RECOVERY_WORDS.includes(word)) {
                return { valid: false, error: `Unknown word: ${word}` };
            }
        }

        return { valid: true };
    },

    // Check if a string is encrypted
    isEncrypted(str) {
        return typeof str === 'string' && str.startsWith('ENC:v1:');
    },

    // Encrypt an object's sensitive fields
    async encryptObject(obj, fields) {
        if (!this.isReady()) return obj;

        const encrypted = { ...obj };
        for (const field of fields) {
            if (encrypted[field] !== undefined && encrypted[field] !== null) {
                encrypted[field] = await this.encryptData(String(encrypted[field]));
            }
        }
        return encrypted;
    },

    // Decrypt an object's sensitive fields
    async decryptObject(obj, fields) {
        if (!this.isReady()) return obj;

        const decrypted = { ...obj };
        for (const field of fields) {
            if (decrypted[field] && this.isEncrypted(decrypted[field])) {
                decrypted[field] = await this.decryptData(decrypted[field]);
            }
        }
        return decrypted;
    },

    // Decrypt an array of objects
    async decryptArray(arr, fields) {
        if (!this.isReady()) return arr;
        return Promise.all(arr.map(obj => this.decryptObject(obj, fields)));
    },

    // Regenerate recovery phrase (creates new phrase that can unlock the same MEK)
    async regenerateRecoveryKey() {
        if (!this.mek) {
            throw new Error('Encryption not unlocked');
        }

        // Generate new recovery phrase
        const recoveryData = this.generateRecoveryKey();

        // Generate new salt for recovery KEK
        const recoverySalt = this.getRandomBytes(16);

        // Derive new recovery KEK
        const recoveryKEK = await this.deriveKey(recoveryData.phrase, recoverySalt);

        // Wrap MEK with new recovery KEK
        const recoveryWrappedMEK = await this.wrapMEK(this.mek, recoveryKEK);

        return {
            recoverySalt: this.bufferToBase64(recoverySalt.buffer),
            recoveryWrappedMEK: recoveryWrappedMEK,
            recoveryPhrase: recoveryData.phrase
        };
    },

    // Remember key functionality - stores encrypted MEK in localStorage
    STORAGE_KEY: 'budget_manager_remembered_key',

    // Save MEK to localStorage with expiry (days, 0 = never expires)
    async rememberKey(days = 7) {
        if (!this.mek) {
            throw new Error('Encryption not unlocked');
        }

        // Generate a random device key
        const deviceKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['wrapKey', 'unwrapKey']
        );

        // Export device key to store it
        const deviceKeyRaw = await crypto.subtle.exportKey('raw', deviceKey);

        // Wrap MEK with device key
        const wrappedMEK = await this.wrapMEK(this.mek, deviceKey);

        // Calculate expiry (0 = never expires)
        const expiry = days === 0 ? null : Date.now() + (days * 24 * 60 * 60 * 1000);

        // Store in localStorage
        const data = {
            deviceKey: this.bufferToBase64(deviceKeyRaw),
            wrappedMEK: wrappedMEK,
            expiry: expiry
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));

        return true;
    },

    // Check if there's a valid remembered key
    hasRememberedKey() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return false;

            const data = JSON.parse(stored);
            // Check expiry (null = never expires)
            if (data.expiry !== null && Date.now() > data.expiry) {
                this.forgetKey();
                return false;
            }
            return true;
        } catch {
            return false;
        }
    },

    // Get remembered key expiry info
    getRememberedKeyInfo() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return null;

            const data = JSON.parse(stored);
            // Check expiry (null = never expires)
            if (data.expiry !== null && Date.now() > data.expiry) {
                this.forgetKey();
                return null;
            }
            return {
                expiry: data.expiry,
                daysRemaining: data.expiry === null ? null : Math.ceil((data.expiry - Date.now()) / (24 * 60 * 60 * 1000)),
                neverExpires: data.expiry === null
            };
        } catch {
            return null;
        }
    },

    // Unlock using remembered key
    async unlockWithRememberedKey() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return false;

            const data = JSON.parse(stored);

            // Check expiry (null = never expires)
            if (data.expiry !== null && Date.now() > data.expiry) {
                this.forgetKey();
                return false;
            }

            // Restore device key
            const deviceKeyRaw = this.base64ToBuffer(data.deviceKey);
            const deviceKey = await crypto.subtle.importKey(
                'raw',
                deviceKeyRaw,
                { name: 'AES-GCM', length: 256 },
                false,
                ['unwrapKey']
            );

            // Unwrap MEK
            const mek = await this.unwrapMEK(data.wrappedMEK, deviceKey);

            // Store in memory
            this.mek = mek;
            this.isUnlocked = true;

            return true;
        } catch (error) {
            console.error('Failed to unlock with remembered key:', error);
            this.forgetKey();
            return false;
        }
    },

    // Clear remembered key
    forgetKey() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    // Session key methods (uses localStorage for mobile compatibility, cleared on logout)

    // Save MEK to localStorage for current login session
    async saveToSession() {
        if (!this.mek) return false;

        try {
            // Generate a random session key
            const sessionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['wrapKey', 'unwrapKey']
            );

            // Export session key
            const sessionKeyRaw = await crypto.subtle.exportKey('raw', sessionKey);

            // Wrap MEK with session key
            const wrappedMEK = await this.wrapMEK(this.mek, sessionKey);

            // Store in localStorage (more reliable on mobile than sessionStorage)
            const data = {
                sessionKey: this.bufferToBase64(sessionKeyRaw),
                wrappedMEK: wrappedMEK,
                isSessionKey: true  // Flag to distinguish from "remember me" keys
            };
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(data));

            return true;
        } catch (error) {
            console.error('Failed to save to session:', error);
            return false;
        }
    },

    // Check if there's a session key
    hasSessionKey() {
        return localStorage.getItem(this.SESSION_KEY) !== null;
    },

    // Restore MEK from localStorage session key
    async unlockFromSession() {
        try {
            const stored = localStorage.getItem(this.SESSION_KEY);
            if (!stored) return false;

            const data = JSON.parse(stored);

            // Restore session key
            const sessionKeyRaw = this.base64ToBuffer(data.sessionKey);
            const sessionKey = await crypto.subtle.importKey(
                'raw',
                sessionKeyRaw,
                { name: 'AES-GCM', length: 256 },
                false,
                ['unwrapKey']
            );

            // Unwrap MEK
            const mek = await this.unwrapMEK(data.wrappedMEK, sessionKey);

            // Store in memory
            this.mek = mek;
            this.isUnlocked = true;

            return true;
        } catch (error) {
            console.error('Failed to unlock from session:', error);
            localStorage.removeItem(this.SESSION_KEY);
            return false;
        }
    },

    // Clear session key (called on logout)
    clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
    }
};

// Export for use in app.js
window.CryptoModule = CryptoModule;
