<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import WeatherControls from "./WeatherControls.svelte";
    import type { Season, Weather } from "../types/chronicle.types";

    export let startingSeason: Season = "Winter";
    export let enableControls: boolean = true;
    export let height: string = "100%";
    export let width: string = "100%";
    export let weather: Weather = "sunny";
    export let enableWeatherControls: boolean = false;

    const THEMES = {
        colors: {
            light: ["#93d5eb", "#add63a", "#c5d63a", "#febe42"],
            medium: ["#66bbd8", "#92c938", "#acc52b", "#ff9d25"],
            dark: ["#4da2bb", "#2a9d5c", "#89a503", "#ff6b2f"],
            background: ["#cbe9f4", "#daf8ff", "#feec98", "#ffdc8a"],
            bush: ["#ffffff", "#3ebf6d", "#99b31a", "#fd6d2e"],
            cloud: ["#ffffff", "#ffffff", "#ffffff", "#eaf9fe"],
        },
        seasons: ["Winter", "Spring", "Summer", "Autumn"],
    };

    let currentSeasonIndex = THEMES.seasons.indexOf(startingSeason);
    let currentWeather = weather;
    let container: HTMLDivElement;
    let sunElement: HTMLDivElement;
    let flowersElements: HTMLDivElement[] = [];
    let snowElements: HTMLDivElement[] = [];
    let rainElements: HTMLDivElement[] = [];

    const ELEMENTS = {
        snow: Array.from({ length: 20 }, (_, i) => i),
        rain: Array.from({ length: 30 }, (_, i) => i),
        bush: Array.from({ length: 9 }, (_, i) => i),
        cloud: Array.from({ length: 8 }, (_, i) => i),
        cone: Array.from({ length: 20 }, (_, i) => i),
        coneLarge: Array.from({ length: 40 }, (_, i) => i),
        branch: Array.from({ length: 12 }, (_, i) => i),
        branch10: Array.from({ length: 10 }, (_, i) => i),
        pineCone: Array.from({ length: 7 }, (_, i) => i),
    };

    function handleSeasonChange(index: number): void {
        currentSeasonIndex = index;
    }

    function handleWeatherChange(event: CustomEvent<{ weather: Weather }>) {
        currentWeather = event.detail.weather;
    }

    $: {
        if (weather !== currentWeather) {
            currentWeather = weather;
        }
    }

    $: if (container && currentSeasonIndex >= 0) {
        const season = THEMES.seasons[currentSeasonIndex];

        container.style.setProperty(
            "--light",
            THEMES.colors.light[currentSeasonIndex],
        );
        container.style.setProperty(
            "--medium",
            THEMES.colors.medium[currentSeasonIndex],
        );
        container.style.setProperty(
            "--dark",
            THEMES.colors.dark[currentSeasonIndex],
        );
        container.style.setProperty(
            "--bush",
            THEMES.colors.bush[currentSeasonIndex],
        );
        container.style.setProperty(
            "--cloud",
            THEMES.colors.cloud[currentSeasonIndex],
        );

        snowElements.forEach((el) => {
            if (el) el.style.display = season === "Winter" ? "block" : "none";
        });

        flowersElements.forEach((el) => {
            if (el) {
                if (season === "Spring") {
                    el.classList.add("animated");
                } else {
                    el.classList.remove("animated");
                }
            }
        });

        if (season === "Summer") {
            container.style.setProperty("--sun", "#ffb53a");
        } else {
            container.style.setProperty("--sun", "transparent");
        }

        rainElements.forEach((el) => {
            if (el) el.style.display = season === "Autumn" ? "block" : "none";
        });
    }

    onMount(() => {
        if (currentSeasonIndex >= 0) {
            const season = THEMES.seasons[currentSeasonIndex];
        }
    });
</script>

<div
    bind:this={container}
    class="season-wrapper weather-{currentWeather}"
    style="height: {height}; width: {width};"
>
    {#if enableControls}
        <div
            class="flex justify-center gap-2 fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50"
        >
            {#each THEMES.seasons as season, index}
                <button
                    class="px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 shadow-sm backdrop-blur-sm bg-white/70 hover:bg-white/90 hover:-translate-y-0.5 focus:outline-none {currentSeasonIndex ===
                    index
                        ? 'bg-white font-bold shadow-md'
                        : ''}"
                    style="border-bottom: 3px solid {THEMES.colors.light[
                        index
                    ]};"
                    on:click={() => handleSeasonChange(index)}
                >
                    {season}
                </button>
            {/each}
        </div>
    {/if}

    {#if enableWeatherControls}
        <WeatherControls
            {currentWeather}
            on:weatherChange={handleWeatherChange}
        />
    {/if}

    <div class="container">
        <div class="season"></div>
        <div bind:this={sunElement} class="sun"></div>

        <div class="cloud-group">
            {#each ELEMENTS.cloud as _, index}
                <div class="cloud">
                    <div class="weather-container">
                        {#each ELEMENTS.snow as _, j}
                            <div
                                class="snow"
                                bind:this={
                                    snowElements[
                                        index * ELEMENTS.snow.length + j
                                    ]
                                }
                            ></div>
                        {/each}
                        {#each ELEMENTS.rain as _, k}
                            <div
                                class="rain"
                                bind:this={
                                    rainElements[
                                        index * ELEMENTS.rain.length + k
                                    ]
                                }
                            ></div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>

        <div class="base">
            <div class="bush-group">
                {#each ELEMENTS.bush as _, index}
                    <div class="bush"></div>
                {/each}
            </div>

            <div class="tree-group">
                {#each Array(3) as _, i}
                    <div class="tree">
                        <div class="trunk"></div>
                        <div class="tree-top"></div>
                    </div>
                {/each}

                <div class="tree">
                    <div class="trunk"></div>
                    {#each ELEMENTS.branch as _, index}
                        <div class="branch"></div>
                    {/each}
                </div>

                <div class="tree">
                    <div class="trunk"></div>
                    <div class="tree-top"></div>
                    <div class="tree-top"></div>
                    {#each Array(3) as _, i}
                        <div class="branch-two">
                            <div class="tree-top"></div>
                        </div>
                    {/each}
                </div>

                {#each Array(2) as _, i}
                    <div class="tree">
                        <div class="trunk"></div>
                        <div class="tree-top"></div>
                    </div>
                {/each}

                <div class="tree">
                    <div class="trunk"></div>
                    <div class="tree-top">
                        {#each ELEMENTS.cone as _, index}
                            <div class="cone"></div>
                        {/each}
                    </div>
                    <div class="tree-top"></div>
                    <div class="tree-top"></div>
                    {#each Array(2) as _, i}
                        <div class="flower" bind:this={flowersElements[i]}>
                            <div class="flower-in"></div>
                            {#each Array(3) as _, j}
                                <div class="petal"></div>
                            {/each}
                        </div>
                    {/each}
                </div>

                <div class="tree">
                    <div class="trunk"></div>
                    <div class="tree-top"></div>
                </div>

                <div class="tree">
                    <div class="trunk"></div>
                    {#each ELEMENTS.branch10 as _, index}
                        <div class="branch">
                            <div class="branch-in"></div>
                            <div class="pine-cone-row">
                                {#each ELEMENTS.pineCone as _, j}
                                    <div class="pine-cone"></div>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>

                <div class="tree">
                    <div class="trunk"></div>
                    {#each Array(3) as _, i}
                        <div class="tree-top"></div>
                    {/each}
                </div>

                <div class="tree">
                    <div class="trunk"></div>
                    <div class="tree-top">
                        {#each ELEMENTS.cone as _, index}
                            <div class="cone"></div>
                        {/each}
                    </div>
                    <div class="tree-top"></div>
                    <div class="tree-top"></div>
                    {#each Array(2) as _, i}
                        <div class="flower" bind:this={flowersElements[i + 2]}>
                            <div class="flower-in"></div>
                            {#each Array(3) as _, j}
                                <div class="petal"></div>
                            {/each}
                        </div>
                    {/each}
                </div>

                <div class="tree">
                    <div class="trunk"></div>
                    {#each Array(3) as _, i}
                        <div class="tree-top"></div>
                    {/each}
                    {#each Array(2) as _, i}
                        <div class="branch-two">
                            <div class="tree-top"></div>
                        </div>
                    {/each}
                </div>

                {#each Array(2) as _, treeIdx}
                    <div class="tree">
                        <div class="trunk"></div>
                        {#each Array(3) as _, i}
                            <div class="tree-top">
                                {#if treeIdx === 0 || i !== 2}
                                    {#each ELEMENTS.cone as _, j}
                                        <div class="cone"></div>
                                    {/each}
                                {:else}
                                    {#each ELEMENTS.coneLarge as _, j}
                                        <div class="cone"></div>
                                    {/each}
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    :root {
        --light: #93d5eb;
        --medium: #66bbd8;
        --dark: #4da2bb;
        --bush: #ffffff;
        --trunk: #c2653c;
        --trunk2: #9d5d5d;
        --cloud: #ffffff;
        --sun: transparent;
    }

    .season-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--bgd-color);
        overflow: hidden;
        width: 100%;
        height: 100%;
    }

    .season-wrapper *,
    .season-wrapper *:before,
    .season-wrapper *:after {
        transition: 4s ease background;
        position: absolute;
    }

    .container {
        position: relative;
        width: 100%;
        height: 100%;
        max-width: 1200px;
        margin: 0 auto;
    }

    .sun {
        background-color: var(--sun);
        width: 60px;
        height: 60px;
        border-radius: 100%;
        top: -20px;
        left: 180px;
    }

    .cloud-group {
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        overflow: hidden;
    }

    .cloud {
        background-color: var(--cloud);
        width: 80px;
        height: 30px;
        border-radius: 50px;
        left: 50px;
        top: 40px;
        animation: clouds 10s linear infinite;
    }

    @keyframes clouds {
        50% {
            transform: translateX(20px);
        }
        100% {
            transform: translateX(0);
        }
    }

    .weather-container {
        width: 100%;
        height: 400px;
    }

    .snow {
        opacity: 0;
        background-color: #ffffff;
        width: 6px;
        height: 6px;
        border-radius: 100%;
        transition: 2s ease all;
        animation: snow 5s linear infinite;
        top: calc(random() * 30px);
        left: calc(random() * 70px);
        animation-delay: calc(random() * 10s);
    }

    .rain {
        opacity: 0;
        display: none;
        background-color: #eaf9fe;
        width: 4px;
        height: 8px;
        transform: rotate(-30deg);
        border-color: #eaf9fe;
        border-top-left-radius: 50%;
        border-bottom-left-radius: 50%;
        border-bottom-right-radius: 50%;
        transition: 2s ease all;
        animation: drops 1s linear infinite;
        top: calc(random() * 30px);
        left: calc(random() * 70px);
    }

    @keyframes drops {
        0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(-30deg);
        }
        5% {
            opacity: 1;
        }
        80% {
            opacity: 1;
        }
        100% {
            transform: translate3d(20px, 200px, 0) rotate(-30deg);
            opacity: 0;
        }
    }

    @keyframes snow {
        0% {
            margin-top: 0px;
            opacity: 0;
        }
        5% {
            opacity: 1;
        }
        50% {
            opacity: 1;
            margin-left: 20px;
        }
        100% {
            margin-top: 200px;
            opacity: 0;
        }
    }

    .cloud:nth-child(2) {
        left: 70px;
        top: 65px;
        width: 90px;
    }

    .cloud:nth-child(3) {
        left: 330px;
        top: 30px;
        width: 80px;
        height: 25px;
    }

    .cloud:nth-child(4) {
        left: 290px;
        top: 60px;
        width: 90px;
    }

    .cloud:nth-child(5) {
        left: 480px;
        top: 40px;
        width: 100px;
    }

    .cloud:nth-child(6) {
        left: 580px;
        top: 80px;
    }

    .cloud:nth-child(7) {
        left: 520px;
        top: 105px;
        width: 110px;
    }

    .cloud:nth-child(8) {
        left: 660px;
        top: 160px;
        width: 70px;
    }

    .base {
        width: 650px;
        height: 20px;
        left: 80px;
        background-color: var(--bush);
        border-radius: 20px;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
    }

    .bush-group {
        width: 100%;
        height: 100%;
        bottom: 5px;
        left: 0;
    }

    .bush {
        z-index: 100;
        width: 90px;
        height: 40px;
        bottom: 0px;
        left: 0;
        background-color: var(--bush);
        border-radius: 50px 50px 0 0;
    }

    .bush:nth-child(2) {
        left: 70px;
    }
    .bush:nth-child(3) {
        left: 140px;
    }
    .bush:nth-child(4) {
        left: 210px;
    }
    .bush:nth-child(5) {
        left: 280px;
    }
    .bush:nth-child(6) {
        left: 350px;
    }
    .bush:nth-child(7) {
        left: 420px;
    }
    .bush:nth-child(8) {
        left: 490px;
    }
    .bush:nth-child(9) {
        left: 560px;
    }

    .tree-group {
        width: 100%;
        height: 350px;
        bottom: 0px;
        left: 0;
    }

    .tree {
        z-index: 1;
        bottom: 10px;
        width: 5px;
        height: 50px;
        left: 10px;
    }

    .tree-top {
        background-color: var(--dark);
        border-radius: 100%;
        top: -30px;
        width: 40px;
        height: 40px;
        left: -20px;
    }

    .tree-top:after {
        content: "";
        position: absolute;
        width: 80%;
        height: 80%;
        top: 5%;
        right: 5%;
        background-color: var(--medium);
        border-radius: 100%;
    }

    .trunk {
        background-color: var(--trunk);
        width: 100%;
        height: 100%;
        border-radius: 10px;
    }

    .tree:nth-child(1) .trunk,
    .tree:nth-child(2) .trunk,
    .tree:nth-child(3) .trunk,
    .tree:nth-child(6) .trunk,
    .tree:nth-child(7) .trunk,
    .tree:nth-child(8) .trunk,
    .tree:nth-child(11) .trunk,
    .tree:nth-child(12) .trunk {
        background-color: var(--trunk2);
    }

    .branch {
        z-index: -1;
        height: 10px;
        width: 40px;
        border-radius: 10px;
        background-color: var(--dark);
        transform: rotate(30deg);
        transform-origin: 0% 0%;
        left: 5px;
    }

    .branch-two {
        top: 70px;
        height: 20px;
        width: 40px;
        border-radius: 0 0 20px 0;
        border: 7px solid var(--trunk);
        border-left: 0;
        border-top: 0;
    }

    .branch-two .tree-top {
        width: 50px;
        height: 20px;
        top: -10px;
        left: 20px;
    }

    .tree:nth-child(2) {
        left: 40px;
        height: 70px;
        width: 6px;
        z-index: 2;
    }

    .tree:nth-child(2) .tree-top {
        background-color: var(--medium);
        top: -35px;
        width: 50px;
        height: 50px;
        left: -23px;
    }

    .tree:nth-child(2) .tree-top:after {
        background-color: var(--light);
    }

    .tree:nth-child(3) {
        left: 80px;
        height: 50px;
    }

    .tree:nth-child(3) .tree-top {
        background-color: var(--medium);
        top: -15px;
        width: 30px;
        height: 30px;
        left: -13px;
    }

    .tree:nth-child(3) .tree-top:after {
        background-color: var(--light);
    }

    .tree:nth-child(4) {
        z-index: 1;
        left: 105px;
        height: 220px;
        width: 10px;
    }

    .tree:nth-child(4) .branch:before {
        content: "";
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: var(--medium);
        border-radius: 10px;
    }

    .tree:nth-child(4) .branch:after {
        z-index: 1;
        content: "";
        left: 0;
        top: 0;
        width: 66%;
        height: 100%;
        background-color: var(--light);
        border-radius: 10px;
    }

    .tree:nth-child(4) .branch:nth-child(7),
    .tree:nth-child(4) .branch:nth-child(8),
    .tree:nth-child(4) .branch:nth-child(9),
    .tree:nth-child(4) .branch:nth-child(10),
    .tree:nth-child(4) .branch:nth-child(11),
    .tree:nth-child(4) .branch:nth-child(12) {
        transform: rotate(150deg);
        top: 7px;
        left: 10px;
    }

    .tree:nth-child(4) .branch:first-child {
        top: 0px;
        width: 40px;
    }

    .tree:nth-child(4) .branch:nth-child(5):before,
    .tree:nth-child(4) .branch:nth-child(6):before,
    .tree:nth-child(4) .branch:nth-child(11):before,
    .tree:nth-child(4) .branch:nth-child(12):before {
        width: 66%;
    }

    .tree:nth-child(4) .branch:nth-child(5):after,
    .tree:nth-child(4) .branch:nth-child(6):after,
    .tree:nth-child(4) .branch:nth-child(11):after,
    .tree:nth-child(4) .branch:nth-child(12):after {
        width: 33%;
    }

    .tree:nth-child(4) .branch:nth-child(3):before,
    .tree:nth-child(4) .branch:nth-child(4):before,
    .tree:nth-child(4) .branch:nth-child(9):before,
    .tree:nth-child(4) .branch:nth-child(10):before {
        width: 100%;
    }

    .tree:nth-child(4) .branch:nth-child(3):after,
    .tree:nth-child(4) .branch:nth-child(4):after,
    .tree:nth-child(4) .branch:nth-child(9):after,
    .tree:nth-child(4) .branch:nth-child(10):after {
        width: 55%;
    }

    .tree:nth-child(4) .branch:nth-child(2) {
        top: 25px;
        width: 50px;
    }

    .tree:nth-child(4) .branch:nth-child(3) {
        top: 50px;
        width: 60px;
    }

    .tree:nth-child(4) .branch:nth-child(4) {
        top: 75px;
        width: 70px;
    }

    .tree:nth-child(4) .branch:nth-child(5) {
        top: 100px;
        width: 80px;
    }

    .tree:nth-child(4) .branch:nth-child(6) {
        top: 125px;
        width: 90px;
    }

    .tree:nth-child(4) .branch:nth-child(7) {
        top: 8px;
        width: 40px;
    }

    .tree:nth-child(4) .branch:nth-child(8) {
        top: 33px;
        width: 50px;
    }

    .tree:nth-child(4) .branch:nth-child(9) {
        top: 58px;
        width: 60px;
    }

    .tree:nth-child(4) .branch:nth-child(10) {
        top: 83px;
        width: 70px;
    }

    .tree:nth-child(4) .branch:nth-child(11) {
        top: 108px;
        width: 80px;
    }

    .tree:nth-child(4) .branch:nth-child(12) {
        top: 133px;
        width: 90px;
    }

    .tree:nth-child(5) {
        left: 140px;
        height: 280px;
        width: 12px;
    }

    .tree:nth-child(5) .tree-top {
        z-index: 3;
        background-color: var(--medium);
        top: -25px;
        width: 120px;
        height: 40px;
        left: -55px;
        border-radius: 50px;
    }

    .tree:nth-child(5) .tree-top:after {
        border-radius: 50px 50px 0 0px;
        background-color: var(--light);
        width: 100%;
        left: 0;
        height: 50%;
        top: 0;
    }

    .tree:nth-child(5) .branch-two:nth-child(5) {
        top: 38px;
        height: 5px;
        width: 60px;
        border-radius: 0 0 20px 0;
        border: 8px solid var(--trunk);
        border-left: 0;
        border-top: 0;
    }

    .tree:nth-child(5) .branch-two:nth-child(5) .tree-top {
        width: 50px;
        height: 20px;
        top: -20px;
        left: 40px;
    }

    .tree:nth-child(5) .branch-two:nth-child(6) .tree-top {
        width: 50px;
        height: 15px;
        top: -10px;
        left: 20px;
    }

    .tree:nth-child(5) .branch-two:nth-child(4) {
        top: 40px;
        height: 10px;
        width: 30px;
        border-radius: 0 0 0px 20px;
        border: 8px solid var(--trunk);
        border-right: 0;
        border-top: 0;
        left: -30px;
    }

    .tree:nth-child(5) .branch-two:nth-child(4) .tree-top {
        width: 40px;
        height: 15px;
        top: -10px;
        left: -25px;
    }

    .tree:nth-child(5) .tree-top:nth-child(2) {
        width: 90px;
        top: -55px;
        height: 30px;
        left: -40px;
    }

    .tree:nth-child(6) {
        left: 180px;
        height: 100px;
        width: 8px;
        z-index: 4;
    }

    .tree:nth-child(6) .tree-top {
        background-color: var(--dark);
        top: -50px;
        width: 80px;
        height: 80px;
        left: -35px;
    }

    .tree:nth-child(6) .tree-top:after {
        background-color: var(--medium);
    }

    .tree:nth-child(7) {
        left: 210px;
        height: 70px;
    }

    .tree:nth-child(7) .tree-top {
        background-color: var(--medium);
        top: -20px;
        width: 40px;
        height: 40px;
        left: -20px;
    }

    .tree:nth-child(7) .tree-top:after {
        background-color: var(--light);
    }

    .tree:nth-child(8) {
        left: 250px;
        height: 120px;
        width: 12px;
        z-index: 3;
    }

    .tree:nth-child(8) .tree-top {
        background-color: var(--light);
        top: -60px;
        width: 130px;
        height: 65px;
        left: -60px;
        border-radius: 50px;
    }

    .tree:nth-child(8) .tree-top:after {
        border-radius: 50px 0 0 50px;
        background-color: var(--medium);
        width: 50%;
        left: 0;
        height: 100%;
        top: 0;
    }

    .tree:nth-child(8) .tree-top:nth-child(2) {
        top: -95px;
        width: 90px;
        height: 55px;
        left: -40px;
    }

    .tree:nth-child(8) .tree-top:nth-child(2):after {
        left: 0;
        height: 100%;
        top: 0;
    }

    .tree:nth-child(8) .tree-top:nth-child(3) {
        top: -120px;
        width: 46px;
        height: 40px;
        left: -18px;
    }

    .tree:nth-child(8) .tree-top:nth-child(3):after {
        left: 0;
        height: 100%;
        top: 0;
    }

    .tree:nth-child(9) {
        left: 310px;
        height: 60px;
    }

    .tree:nth-child(9) .tree-top {
        background-color: var(--medium);
        top: -13px;
        width: 30px;
        height: 30px;
        left: -13px;
    }

    .tree:nth-child(9) .tree-top:after {
        background-color: var(--light);
    }

    .tree:nth-child(10) {
        left: 340px;
        height: 290px;
        width: 10px;
        z-index: 2;
    }

    .tree:nth-child(10) .branch {
        height: 10px;
        width: 40px;
        background-color: var(--trunk);
        left: 5px;
        top: -1px;
    }

    .tree:nth-child(10) .branch-in {
        z-index: 100;
        width: 100%;
        height: 100%;
        background-color: var(--trunk);
        border-radius: 10px;
    }

    .tree:nth-child(10) .branch:nth-child(7),
    .tree:nth-child(10) .branch:nth-child(8),
    .tree:nth-child(10) .branch:nth-child(9),
    .tree:nth-child(10) .branch:nth-child(10),
    .tree:nth-child(10) .branch:nth-child(11) {
        transform: rotate(150deg);
        top: 7px;
        left: 10px;
    }

    .tree:nth-child(10) .branch:nth-child(2) {
        top: 0px;
        width: 40px;
    }

    .tree:nth-child(10) .branch:nth-child(3) {
        top: 40px;
        width: 50px;
    }

    .tree:nth-child(10) .branch:nth-child(4) {
        top: 80px;
        width: 60px;
    }

    .tree:nth-child(10) .branch:nth-child(5) {
        top: 120px;
        width: 70px;
    }

    .tree:nth-child(10) .branch:nth-child(6) {
        top: 160px;
        width: 80px;
    }

    .tree:nth-child(10) .branch:nth-child(7) {
        top: 8px;
        width: 40px;
    }

    .tree:nth-child(10) .branch:nth-child(8) {
        top: 48px;
        width: 50px;
    }

    .tree:nth-child(10) .branch:nth-child(9) {
        top: 88px;
        width: 60px;
    }

    .tree:nth-child(10) .branch:nth-child(10) {
        top: 168px;
        width: 70px;
    }

    .tree:nth-child(10) .branch:nth-child(11) {
        top: 128px;
        width: 80px;
    }

    /* Pine cone styling */
    .pine-cone {
        height: 25px;
        width: 10px;
        top: 5px;
        left: 15px;
        border-radius: 0 0 10px 10px;
        background-color: var(--light);
        transform: rotate(-30deg);
    }

    .tree:nth-child(10) .pine-cone:nth-child(2n + 2) {
        background-color: var(--medium);
    }

    .tree:nth-child(10) .pine-cone:nth-child(3n + 3) {
        background-color: var(--dark);
    }

    .tree:nth-child(10) .branch:nth-child(7) .pine-cone,
    .tree:nth-child(10) .branch:nth-child(8) .pine-cone,
    .tree:nth-child(10) .branch:nth-child(9) .pine-cone,
    .tree:nth-child(10) .branch:nth-child(10) .pine-cone,
    .tree:nth-child(10) .branch:nth-child(11) .pine-cone {
        transform: rotate(210deg);
        left: 16px;
        top: -20px;
    }

    .tree:nth-child(11) {
        z-index: 3;
        left: 390px;
        height: 80px;
        width: 8px;
    }

    .tree:nth-child(11) .tree-top {
        background-color: var(--light);
        top: -30px;
        width: 80px;
        height: 40px;
        left: -35px;
        border-radius: 50px;
    }

    .tree:nth-child(11) .tree-top:after {
        border-radius: 50px 0 0 50px;
        background-color: var(--medium);
        width: 50%;
        left: 0;
        height: 100%;
        top: 0;
    }

    .tree:nth-child(11) .tree-top:nth-child(2) {
        top: -50px;
        width: 60px;
        height: 30px;
        left: -25px;
    }

    .tree:nth-child(11) .tree-top:nth-child(3) {
        top: -65px;
        width: 40px;
        height: 30px;
        left: -15px;
    }

    .tree:nth-child(12) {
        left: 430px;
        height: 130px;
        width: 10px;
    }

    .tree:nth-child(12) .tree-top {
        background-color: var(--medium);
        top: -50px;
        width: 130px;
        height: 55px;
        left: -60px;
        border-radius: 50px;
    }

    .tree:nth-child(12) .tree-top:after {
        border-radius: 50px 0 0 50px;
        background-color: var(--dark);
        width: 50%;
        left: 0;
        height: 100%;
        top: 0;
    }

    .tree:nth-child(12) .tree-top:nth-child(2) {
        top: -85px;
        width: 90px;
        height: 45px;
        left: -40px;
    }

    .tree:nth-child(12) .tree-top:nth-child(3) {
        top: -110px;
        width: 50px;
        height: 40px;
        left: -20px;
    }

    .tree:nth-child(12) .flower:nth-child(6) {
        top: -70px;
        left: 22px;
    }

    .tree:nth-child(12) .flower:nth-child(5) {
        top: -30px;
        left: -30px;
    }

    .tree:nth-child(13) {
        z-index: 3;
        left: 480px;
        height: 70px;
        width: 12px;
    }

    .tree:nth-child(13) .tree-top {
        z-index: 3;
        background-color: var(--medium);
        top: -25px;
        width: 90px;
        height: 30px;
        left: -40px;
        border-radius: 50px;
    }

    .tree:nth-child(13) .tree-top:after {
        border-radius: 50px 50px 0 0px;
        background-color: var(--light);
        width: 100%;
        left: 0;
        height: 50%;
        top: 0;
    }

    .tree:nth-child(13) .tree-top:nth-child(2) {
        z-index: 2;
        top: -50px;
        width: 70px;
        height: 25px;
        left: -30px;
    }

    .tree:nth-child(13) .tree-top:nth-child(3) {
        z-index: 1;
        top: -70px;
        width: 50px;
        height: 20px;
        left: -20px;
    }

    .tree:nth-child(13) .branch-two:nth-child(5) {
        top: 23px;
        height: 5px;
        width: 30px;
        border-radius: 0 0 20px 0;
        border: 6px solid var(--trunk);
        border-left: 0;
        border-top: 0;
    }

    .tree:nth-child(13) .branch-two:nth-child(5) .tree-top {
        width: 40px;
        height: 14px;
        top: -13px;
        left: 15px;
    }

    .tree:nth-child(13) .branch-two:nth-child(6) {
        top: 17px;
        height: 5px;
        width: 20px;
        border-radius: 0 0 0px 20px;
        border: 6px solid var(--trunk);
        border-right: 0;
        border-top: 0;
        left: -20px;
    }

    .tree:nth-child(13) .branch-two:nth-child(6) .tree-top {
        width: 24px;
        height: 10px;
        top: -10px;
        left: -14px;
    }

    .tree:nth-child(14),
    .tree:nth-child(15) {
        z-index: 2;
        left: 550px;
        height: 120px;
        width: 7px;
    }

    .tree:nth-child(14) .tree-top,
    .tree:nth-child(15) .tree-top {
        z-index: 1;
        background-color: var(--dark);
        top: -40px;
        width: 100px;
        height: 90px;
        left: -45px;
        border-radius: 0;
        clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    }

    .tree:nth-child(14) .tree-top:after,
    .tree:nth-child(15) .tree-top:after {
        content: none;
    }

    .tree:nth-child(14) .tree-top:nth-child(2),
    .tree:nth-child(15) .tree-top:nth-child(2) {
        z-index: 2;
        background-color: var(--medium);
        top: -60px;
        width: 80px;
        height: 70px;
        left: -37px;
    }

    .tree:nth-child(14) .tree-top:nth-child(3),
    .tree:nth-child(15) .tree-top:nth-child(3) {
        z-index: 3;
        background-color: var(--light);
        top: -75px;
        width: 60px;
        height: 50px;
        left: -27px;
    }

    .tree:nth-child(15) {
        left: 600px;
        height: 80px;
    }

    .tree:nth-child(15) .tree-top {
        top: -40px;
        width: 80px;
        height: 70px;
        left: -37px;
    }

    .tree:nth-child(15) .tree-top:nth-child(2) {
        top: -60px;
        width: 65px;
        height: 60px;
        left: -30px;
    }

    .tree:nth-child(15) .tree-top:nth-child(3) {
        top: -70px;
        width: 50px;
        height: 40px;
        left: -22px;
    }

    /* Cone styling */
    .cone {
        z-index: 4;
        position: absolute;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 5px solid rgba(0, 0, 0, 0.1);
    }

    /* Flower styling */
    .flower {
        width: 12px;
        height: 12px;
        top: -30px;
        left: 30px;
        visibility: hidden;
        transform-origin: 50% 50%;
    }

    .flower.animated {
        animation: flower 11s ease;
        visibility: visible;
    }

    .flower .flower-in {
        z-index: 2;
        width: 100%;
        height: 100%;
        border-radius: 100px;
        background-color: #de3194;
    }

    .flower .petal {
        z-index: 1;
        width: 36px;
        height: 12px;
        background-color: #ff8cd0;
        border-radius: 50%;
        top: 0%;
        left: -100%;
        transform-origin: 50% 50%;
    }

    .flower .petal:nth-child(2) {
        transform: rotate(55deg);
    }

    .flower .petal:nth-child(3) {
        transform: rotate(120deg);
    }

    .flower:nth-child(6) {
        top: -70px;
        left: -22px;
    }

    @keyframes flower {
        0%,
        100% {
            transform: scale(0);
        }
        20%,
        80% {
            transform: scale(0.8);
        }
    }

    /* Weather variations */
    /* Sunny weather */
    .weather-sunny {
        --bgd-color: #000000;
        --light: #93d5eb;
        --medium: #66bbd8;
        --dark: #4da2bb;
        --bush: #ffffff;
        --cloud: #ffffff;
    }

    /* Partly cloudy weather */
    .weather-partly-cloudy {
        --bgd-color: #046180;
        --light: #a3c9d6;
        --medium: #7ab3c4;
        --dark: #5a9db2;
        --bush: #e6f3f7;
        --cloud: #b3d9e6;
    }

    /* Cloudy weather */
    .weather-cloudy {
        --bgd-color: #a27438;
        --light: #b3d9e6;
        --medium: #8cc6d9;
        --dark: #66b3cc;
        --bush: #e6f3f7;
        --cloud: #d4e9f0;
    }

    /* Rainy weather */
    .weather-rainy {
        --bgd-color: #011a23;
        --light: #a3c9d6;
        --medium: #7ab3c4;
        --dark: #5a9db2;
        --bush: #c4e3ea;
        --cloud: #b3d9e6;
    }

    /* Stormy weather */
    .weather-stormy {
        --bgd-color: #5f9814;
        --light: #8cc6d9;
        --medium: #66b3cc;
        --dark: #4a90a0;
        --bush: #a3c9d6;
        --cloud: #93d5eb;
    }

    /* Aurora weather */
    .weather-aurora {
        --bgd-color: #1a1a2e;
        --light: #4a90e2;
        --medium: #357abd;
        --dark: #2a5c8a;
        --bush: #2a2a4a;
        --cloud: #2a2a4a;
    }

    /* Stardust weather */
    .weather-stardust {
        --bgd-color: #1a1a2e;
        --light: #ffd700;
        --medium: #ffb700;
        --dark: #ff8c00;
        --bush: #2a2a4a;
        --cloud: #2a2a4a;
    }

    /* Flower animations */
    @keyframes flowerWave {
        0%,
        100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
        }
    }

    /* Weather-specific flower animations */
    .weather-sunny .flower,
    .weather-partly-cloudy .flower {
        animation: flowerWave 3s ease-in-out infinite;
    }

    .weather-cloudy .flower,
    .weather-rainy .flower {
        animation: flowerWave 4s ease-in-out infinite;
    }

    .weather-stormy .flower {
        animation: flowerWave 5s ease-in-out infinite;
    }

    .weather-aurora .flower,
    .weather-stardust .flower {
        animation: flowerWave 6s ease-in-out infinite;
    }
</style>
