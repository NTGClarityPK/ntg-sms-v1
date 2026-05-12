"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.join(__dirname, '../.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
async function resetPasswordById(userId, newPassword) {
    try {
        console.log(`\nResetting password for user id: ${userId}\n`);
        const { data, error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword,
        });
        if (error) {
            throw new Error(`Failed to reset password: ${error.message}`);
        }
        console.log('\n✅ Password reset successfully!');
        console.log(`\nNew password: ${newPassword}`);
        console.log(`\nUser can now login with this password.`);
    }
    catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}
const userId = process.argv[2];
const newPassword = process.argv[3] || 'TempPassword@123';
if (!userId) {
    console.error('Usage: ts-node reset-password.ts <userId> [newPassword]');
    console.error('Example: ts-node reset-password.ts 85c67153-4cc5-4891-82d1-c98a0be11136 MyNewPassword@123');
    process.exit(1);
}
resetPasswordById(userId, newPassword);
//# sourceMappingURL=reset-password.js.map