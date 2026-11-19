// Supabase Edge Function: r2-presign
// Sinh Presigned PUT URL để client upload trực tiếp lên Cloudflare R2
// Deploy: npx supabase functions deploy r2-presign
// Secrets cần set:
//   npx supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=... R2_PUBLIC_URL=...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3"
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // 1. Xác thực người dùng qua JWT Supabase
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Thiếu token Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Người dùng chưa xác thực hoặc token hết hạn" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 2. Đọc payload
    const { key, contentType } = await req.json()
    if (!key) {
      return new Response(JSON.stringify({ error: "Thiếu tham số 'key'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Đảm bảo đường dẫn key luôn bắt đầu bằng <user.id>/ để phân vùng bảo mật
    if (!key.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: "Key phải bắt đầu bằng ID người dùng" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 3. Khởi tạo S3 Client cho Cloudflare R2
    const accountId = Deno.env.get("R2_ACCOUNT_ID")
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")
    const bucketName = Deno.env.get("R2_BUCKET_NAME")
    const publicBaseUrl = (Deno.env.get("R2_PUBLIC_URL") || "").replace(/\/+$/, "")

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return new Response(
        JSON.stringify({
          error: "Chưa cấu hình biến môi trường R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType || "audio/mpeg",
    })

    // Presigned URL có hạn 15 phút (900s)
    const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 900 })
    const publicUrl = publicBaseUrl ? `${publicBaseUrl}/${key}` : key

    return new Response(
      JSON.stringify({
        uploadUrl,
        publicUrl,
        key,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Lỗi server" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
