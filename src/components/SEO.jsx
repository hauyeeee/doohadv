import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, image, url }) => {
  const siteTitle = "DOOH Adv Platform - 戶外廣告競價系統";
  const defaultDesc = "全港首個自助戶外廣告競價平台，即時上架，靈活定價。";
  const defaultImage = "https://www.doohadv.com/og-image.jpg"; // 記得放一張預設圖在 public folder
  const siteUrl = "https://www.doohadv.com";

  return (
    <Helmet>
      {/* 基本 Meta Tags */}
      <title>{title ? `${title} | ${siteTitle}` : siteTitle}</title>
      <meta name="description" content={description || defaultDesc} />
      <link rel="canonical" href={url || siteUrl} />

      {/* Open Graph (Facebook / WhatsApp 預覽) */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title || siteTitle} />
      <meta property="og:description" content={description || defaultDesc} />
      <meta property="og:image" content={image || defaultImage} />
      <meta property="og:url" content={url || siteUrl} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title || siteTitle} />
      <meta name="twitter:description" content={description || defaultDesc} />
      <meta name="twitter:image" content={image || defaultImage} />
    </Helmet>
  );
};

export default SEO;