plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.bekir.bekofy"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.bekir.bekofy"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.4.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.media:media:1.7.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}

// Automatically sync web frontend assets from root src/ into android assets before build
tasks.register<Copy>("syncWebAssets") {
    from(file("../../src"))
    into(file("src/main/assets"))
}

tasks.named("preBuild") {
    dependsOn("syncWebAssets")
}
